// V11 HUD: almost nothing on screen. The world shows the time (the sky), Mori shows how tired he is
// (breathing, sweat, a canteen that only appears when he's running low), the camera shows its own
// film count in the viewfinder. What's left is physical and comes and goes:
//   - the quest note: a torn scrap of Mori's journal pinned in the top corner with the current step
//     handwritten on it; it slides in when something changes (the old step gets ticked and struck
//     through in ink, the new one is written in), then fades away. Hover the corner (or tap the
//     little folded corner) to bring it back; click it to open the field journal (J).
//   - the place: a handwritten name that writes itself in when you walk somewhere new, then fades.
//   - the kit in the bottom corner: the backpack (things fly into it), the field laptop when there's
//     something to upload, the canteen when energy is low.
//   - research points: a "+15 RP" stamp when they come in, no counter.
//   - the controls: a pencilled line at the bottom for the first seconds of a scene.
// The API is the V2 Hud2 one (setPlace, setKeys, setLaptop, show, refresh, update, flyItem, banner,
// packPos, bumpPack, destroy), so every scene keeps working.

import { el } from './ui';
import { game } from '../game/game';
import { audio } from '../core/audio';
import { trackedQuest, currentStepIndex, setQuestNotice } from '../game/quests';
import type { QuestDef } from '../game/quests';
import { capacity } from '../game/inventory';
import { itemIconURL, uiIconURL } from '../art/itemicons';
import { mountBodyHud, BodyHud } from './v10/bodyhud';
import { installPaper, paperTex, edgeClip, checkbox, struck, tallyMarks, stamp, pin, svgInk, underline, paperSfx, escHtml as esc, tilt, INK_RED, setTransitionFocus } from './v11/paper';

const CSS = `
.h2 { position: absolute; inset: 0; pointer-events: none; transition: opacity 0.3s; }
.h2.off { opacity: 0; }
/* the quest note */
.hm-q { position: absolute; right: 1.2em; top: 0.9em; width: min(17.5em, 40vw); pointer-events: auto; cursor: pointer; transform-origin: 90% 0;
  transition: transform 0.55s cubic-bezier(.25,1.3,.4,1), opacity 0.5s; filter: drop-shadow(0 0.18em 0.22em rgba(20, 12, 4, 0.45)); }
.hm-q.hid { transform: translate(0.6em, -115%) rotate(6deg); opacity: 0; pointer-events: none; }
.hm-q .in { position: relative; padding: 0.75em 0.95em 0.85em 1.05em; color: var(--pp-ink); background-size: 256px 256px; }
.hm-q .in::before { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(180deg, transparent 0 calc(1.32em - 1px), rgba(70, 110, 160, 0.18) calc(1.32em - 1px) 1.32em); }
.hm-q .ti { position: relative; font-size: 0.72em; letter-spacing: 0.12em; text-transform: uppercase; color: #6a5a40; margin-bottom: 0.2em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 0.6em; }
.hm-q .st { position: relative; display: flex; gap: 0.4em; align-items: flex-start; font-size: 1.32em; line-height: 1.02; }
.hm-q .st + .st { margin-top: 0.25em; }
.hm-q .st.old { color: #6a6458; }
.hm-q .st .tx { flex: 1; min-width: 0; }
.hm-q .st.new .tx { animation: hmWrite 1.1s steps(18) both; }
@keyframes hmWrite { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.hm-q .pr { position: relative; margin: 0.2em 0 0 1.65em; font-size: 0.95em; color: var(--pp-pencil); display: flex; align-items: center; gap: 0.4em; }
.hm-q .pp-pin { left: 50%; top: -0.35em; margin-left: -0.45em; }
.hm-q .new-q { position: absolute; right: -0.6em; top: -0.9em; font-size: 0.68em; }
.hm-peek { position: absolute; right: 0.5em; top: 0.5em; width: 2.1em; height: 2.1em; pointer-events: auto; cursor: pointer; opacity: 0; transition: opacity 0.6s, transform 0.2s; }
.hm-peek.on { opacity: 0.75; }
.hm-peek:hover { opacity: 1; transform: rotate(-6deg) scale(1.08); }
.hm-peek i { position: absolute; inset: 0; clip-path: polygon(0 0, 100% 0, 100% 100%); box-shadow: inset 0 0 0.4em rgba(80,50,20,0.35); }
.hm-peek b { position: absolute; right: 0.15em; top: 0.1em; }
.hm-hot { position: absolute; right: 0; top: 0; width: 22vw; height: 18vh; pointer-events: auto; }
body.touchmode .hm-hot { display: none; }
/* the place name */
.hm-place { position: absolute; left: 1.4em; top: 1em; color: #fff6e0; text-shadow: 0 0.06em 0.3em rgba(0,0,0,0.75), 0 0 0.12em rgba(0,0,0,0.6); opacity: 0; transition: opacity 0.9s; }
.hm-place.on { opacity: 1; }
.hm-place b { display: block; font-size: 2.2em; font-weight: 600; line-height: 1; }
.hm-place.on b { animation: hmWrite 1.2s steps(22) both; }
.hm-place small { display: block; font-size: 1.15em; opacity: 0.9; margin-top: 0.1em; }
.hm-place .ul { display: block; width: 11em; height: 0.5em; margin-top: 0.1em; }
.hm-place .ul path { filter: drop-shadow(0 0 2px rgba(0,0,0,0.6)); }
/* the controls line */
.hm-keys { position: absolute; left: 50%; bottom: 0.9em; transform: translateX(-50%); font-size: 1.12em; color: #fff4dc; white-space: nowrap; text-shadow: 0 0.05em 0.3em rgba(0,0,0,0.9); transition: opacity 1.2s; opacity: 0.88; }
.hm-keys.gone { opacity: 0; }
.hm-keys .key { font-size: 0.68em !important; }
body.touchmode .hm-keys { display: none; }
/* the kit in the corner */
.hm-kit { position: absolute; left: 1em; bottom: 0.8em; display: flex; align-items: flex-end; gap: 0.7em; }
.hm-it { position: relative; pointer-events: auto; cursor: pointer; opacity: 0.6; transition: opacity 0.3s, transform 0.15s; filter: drop-shadow(0 0.15em 0.15em rgba(0,0,0,0.55)); }
.hm-it:hover { opacity: 1; transform: translateY(-0.15em) rotate(-3deg); }
.hm-it img { display: block; width: 2.9em; height: 2.9em; image-rendering: pixelated; }
.hm-it .n { position: absolute; left: 100%; bottom: 0.1em; margin-left: 0.2em; font-size: 1.05em; color: #fff4dc; text-shadow: 0 0.05em 0.25em rgba(0,0,0,0.9); white-space: nowrap; }
.hm-it.full { opacity: 0.95; }
.hm-it.full .n { color: #ffb8a0; }
.hm-it.bump { animation: hmBump 0.4s cubic-bezier(.2,1.8,.4,1); }
@keyframes hmBump { 40% { transform: scale(1.25) rotate(-6deg); opacity: 1; } }
.hm-it .badge { position: absolute; right: -0.5em; top: -0.45em; min-width: 1.4em; height: 1.4em; border-radius: 50%; display: grid; place-items: center; font-size: 0.95em; color: #fff;
  background: #b8321e; box-shadow: 0 0 0 0.12em #f4e6c4; }
.hm-it.lap { display: none; } .hm-it.lap.on { display: block; opacity: 0.9; }
.hm-can { position: absolute; left: 1em; bottom: 4.6em; pointer-events: auto; cursor: pointer; display: flex; align-items: flex-end; gap: 0.35em; opacity: 0; transform: translateY(0.6em); transition: opacity 0.6s, transform 0.6s; filter: drop-shadow(0 0.15em 0.15em rgba(0,0,0,0.55)); }
.hm-can.on { opacity: 1; transform: none; }
.hm-can.crit .bottle { animation: hmShake 0.9s ease-in-out infinite; }
@keyframes hmShake { 20% { transform: rotate(-6deg); } 40% { transform: rotate(5deg); } 60% { transform: rotate(-3deg); } 80% { transform: none; } }
.hm-can .bottle { position: relative; width: 1.9em; height: 3em; }
.hm-can .bottle svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.hm-can span { font-size: 1.05em; color: #fff4dc; text-shadow: 0 0.05em 0.25em rgba(0,0,0,0.9); line-height: 1; }
.hm-can span .key { font-size: 0.62em !important; }
.hm-ail { display: block; color: #e0f0a0; }
body.touchmode .hm-kit { display: none; }
body.touchmode .hm-can { left: 0.8em; top: 4.2em; bottom: auto; }
body.touchmode .hm-place { top: 3.6em; }
/* research points and banners */
.hm-rp { position: absolute; right: 2em; top: 7.2em; font-size: 1.15em; pointer-events: none; animation: hmRp 2.6s ease-out forwards; }
@keyframes hmRp { 0% { opacity: 0; } 10% { opacity: 1; } 75% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-0.8em); } }
.hm-ban { position: absolute; left: 50%; top: 14%; transform: translateX(-50%); pointer-events: none; z-index: 4; text-align: center; animation: hmBan 3.4s ease-out both; filter: drop-shadow(0 0.25em 0.3em rgba(0,0,0,0.5)); }
.hm-ban .in { padding: 0.8em 1.6em 0.9em; background-size: 256px 256px; color: var(--pp-ink); }
.hm-ban .t { font-size: 1.15em; }
.hm-ban .s { font-size: 1.25em; margin-top: 0.3em; max-width: 26em; }
@keyframes hmBan { 0% { opacity: 0; transform: translateX(-50%) translateY(-40%) rotate(-4deg); } 10% { opacity: 1; transform: translateX(-50%) rotate(-1deg); } 85% { opacity: 1; transform: translateX(-50%) rotate(-1deg); } 100% { opacity: 0; transform: translateX(-50%) translateY(-0.6em) rotate(-1deg); } }
.flyitem { position: absolute; width: 36px; height: 36px; image-rendering: pixelated; pointer-events: none; z-index: 9; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); }
.pickup { position: absolute; transform: translate(-50%, -100%); font-family: var(--pp-hand); font-size-adjust: none !important; font-size: 1.35em; font-weight: 600; color: #fff6dc; text-shadow: 0 0.05em 0.3em rgba(0,0,0,0.85); pointer-events: none; animation: pickupRise 1.3s ease-out forwards; white-space: nowrap; }
@keyframes pickupRise { 0% { opacity: 0; transform: translate(-50%, -80%) scale(0.7); } 15% { opacity: 1; transform: translate(-50%, -110%) scale(1.1); } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1); } }
/* the interaction prompt: a manila tag on a string */
#ui .prompt.panel { border: 0 !important; border-image: none !important; box-shadow: none !important; background: linear-gradient(180deg, #ecd6a2, #d9b87c) !important;
  clip-path: polygon(0.85em 0, 100% 0, 100% 100%, 0.85em 100%, 0 50%) !important; padding: 0.12em 0.75em 0.2em 1.35em; color: #3a2614; font-family: var(--pp-hand); font-size: 1.3em; font-weight: 600; filter: drop-shadow(0 0.1em 0.12em rgba(0,0,0,0.4)); }
#ui .prompt.panel, #ui .prompt.panel * { font-size-adjust: none; -webkit-font-smoothing: antialiased; }
#ui .prompt.panel::before { content: ''; position: absolute; left: 0.55em; top: 50%; width: 0.36em; height: 0.36em; margin-top: -0.18em; border-radius: 50%; background: rgba(40,24,8,0.6); }
#ui .prompt.panel .key { font-family: var(--pp-pix) !important; font-size: 0.55em !important; vertical-align: 0.2em; font-size-adjust: 0.62; }
/* toasts: little paper slips */
#ui .toast.panel { border: 0 !important; border-image: none !important; background: ${'${PAPER}'} !important; box-shadow: 0 0.2em 0.35em rgba(0,0,0,0.4) !important; color: var(--pp-ink);
  font-family: var(--pp-hand); font-size: 1.12em; padding: 0.4em 0.9em 0.45em; transform: rotate(-0.8deg); }
#ui .toast.panel, #ui .toast.panel * { font-size-adjust: none; -webkit-font-smoothing: antialiased; }
#ui .toast.panel .ic { font-family: var(--pp-head) !important; font-size-adjust: 0.62; font-size: 0.62em; background: none !important; box-shadow: inset 0 0 0 0.14em currentColor !important; color: #a8321e !important; transform: rotate(-4deg); }
#ui .toast.panel.teal .ic { color: #26408a !important; }
#ui .toast.panel b { color: #2a2440; }
/* the region-map button from the expedition runtime: a folded map in the corner */
#ui .v10-mapb { left: 1em; top: auto; bottom: 4.4em; padding: 0.15em 0.5em 0.15em 0.15em; background: none; box-shadow: none; opacity: 0.6; filter: drop-shadow(0 0.15em 0.15em rgba(0,0,0,0.55)); }
#ui .v10-mapb:hover { opacity: 1; }
#ui .v10-mapb i { background: none; }
#ui .v10-mapb .k { display: none; }
#ui .v10-mapb .t { font-family: var(--pp-hand); font-size-adjust: none; font-size: 1.15em; color: #fff4dc; text-shadow: 0 0.05em 0.25em rgba(0,0,0,0.9); }
body.touchmode #ui .v10-mapb { bottom: auto; top: 0.6em; left: 0.6em; }
`;

let styled = false;

/** the island's field laptop on the belt (see game/v9/research9.ts) */
export interface HudLaptop {
  shown: () => boolean;
  /** photos waiting on the camera */
  badge: () => number;
  open: () => void;
}

/** 16x16 pixel laptop (lid up, aqua screen) drawn at 3x */
let lapIcon = '';
function laptopIconURL(): string {
  if (lapIcon) return lapIcon;
  const rows = [
    '................', '................', '..kkkkkkkkkkkk..', '..kTTTTTTTTTTk..', '..kTjCCCCCCcTk..', '..kTCjCCCCCcTk..', '..kTCCCCCCccTk..', '..kTCCGGCcccTk..',
    '..kTGGGGGGGGTk..', '..kTTTTTTTTTTk..', '.kkkkkkkkkkkkkk.', 'kqqqqqqqqqqqqqqk', 'kTqTqTqTqTqTqTqk', 'kTTTTTTKKTTTTTTk', '.kkkkkkkkkkkkkk.', '................',
  ];
  const col: Record<string, string> = { k: '#0b0f12', T: '#7a8189', q: '#b9c0c4', K: '#454b53', C: '#3fd1c1', c: '#138a86', j: '#eafffb', G: '#6fb150' };
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const v = col[r[x]]; if (v) { g.fillStyle = v; g.fillRect(x * 3, y * 3, 3, 3); } } });
  lapIcon = c.toDataURL();
  return lapIcon;
}

export interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}

type SceneLike = { player?: { x: number; y: number; body?: { showEmote?(e: string, t?: number): void } }; cutscene?: boolean; st?: { cam: { x: number; y: number; zoom: number } } } | null;

export class Hud2 {
  readonly root: HTMLElement;
  private q: HTMLElement;
  private qIn: HTMLElement;
  private peek: HTMLElement;
  private place: HTMLElement;
  private keys: HTMLElement;
  private pack: HTMLElement;
  private lapEl: HTMLElement;
  private lap: HudLaptop | null = null;
  private body: BodyHud | null = null;
  private lastKey = '';
  private lastQuest = '';
  private lastStep = -1;
  private showT = 0;
  private hover = false;
  private placeName = '';
  private placeT = 0;
  private keysT = 7;
  private moved = false;
  private idleT = 0;
  private lastRp = -1;
  private t = 0;
  private bannerT = 0;
  private swapT: ReturnType<typeof setTimeout> | null = null;
  private dayShown = -1;
  /** a new side quest is on the note for a moment */
  private holdT = 0;

  constructor(parent: HTMLElement, o: HudOpts) {
    installPaper();
    if (!styled) { styled = true; document.head.appendChild(el('style', '', CSS.replace('${PAPER}', `${paperTex('card')} 0 0 / 256px`))); }
    this.root = parent.appendChild(el('div', 'h2'));
    // the quest note and its folded corner
    this.q = this.root.appendChild(el('div', 'hm-q hid'));
    this.qIn = this.q.appendChild(el('div', 'in'));
    this.qIn.style.backgroundImage = paperTex('journal');
    this.qIn.style.clipPath = edgeClip(7, { top: 'perforated', bottom: 'torn', left: 'deckle', right: 'deckle', amp: 0.8 });
    this.q.style.transform = '';
    this.q.addEventListener('click', e => { e.stopPropagation(); this.openJournal(); });
    this.peek = this.root.appendChild(el('div', 'hm-peek'));
    this.peek.innerHTML = `<i style="background:${paperTex('journal')} 0 0/256px"></i><b>${svgInk(20, 20, [{ d: 'M4 10 L9 15 L17 4', c: INK_RED, w: 2.2 }], { w: '0.9em', h: '0.9em' })}</b>`;
    this.peek.title = 'What am I doing? (J)';
    this.peek.addEventListener('pointerdown', e => { e.stopPropagation(); if (this.showT > 0) this.openJournal(); else this.reveal(6); });
    const hot = this.root.appendChild(el('div', 'hm-hot'));
    hot.addEventListener('pointerenter', () => { this.hover = true; this.reveal(1.5); });
    hot.addEventListener('pointerleave', () => { this.hover = false; });
    hot.addEventListener('click', e => { e.stopPropagation(); this.openJournal(); });
    // place name, controls line
    this.place = this.root.appendChild(el('div', 'hm-place pp-hand'));
    this.keys = this.root.appendChild(el('div', 'hm-keys pp-hand'));
    // the kit
    const kit = this.root.appendChild(el('div', 'hm-kit'));
    this.pack = kit.appendChild(el('div', 'hm-it pack', `<img src="${uiIconURL('pack', 3)}" alt=""><span class="n pp-hand"></span>`));
    this.pack.title = 'Backpack (I / Tab)';
    this.pack.addEventListener('pointerdown', e => { e.stopPropagation(); o.onBackpack?.(); });
    this.lapEl = kit.appendChild(el('div', 'hm-it lap', `<img src="${laptopIconURL()}" alt=""><b class="badge pp-hand"></b>`));
    this.lapEl.title = 'Laptop (L)';
    this.lapEl.addEventListener('pointerdown', e => { e.stopPropagation(); this.lap?.open(); });
    this.body = mountBodyHud(this.root);
    this.setPlace(o.place, o.sub);
    this.keys.innerHTML = o.keys ?? '<span class="key">A</span><span class="key">D</span> move · <span class="key">E</span> use · <span class="key">I</span> backpack · <span class="key">J</span> journal';
    if (!/journal/.test(this.keys.innerHTML)) this.keys.innerHTML += ' · <span class="key">J</span> journal';
    setQuestNotice(q => this.noticeQuest(q));
    // transitions centre their iris / first ink blot on Mori
    setTransitionFocus(() => {
      const s = game.scene as SceneLike;
      const p = s?.player, c = s?.st?.cam;
      if (!p || !c) return null;
      const r = game.r;
      return [Math.max(0, Math.min(1, r.projectX(p.x, 1) / r.VW)), Math.max(0, Math.min(1, r.projectY(p.y - 20, 1) / r.VH))];
    });
    this.lastRp = game.save.rp;
    this.refresh(true);
    // a fresh scene: show where we are and what we're doing for a few seconds
    this.reveal(5.5);
  }

  // ---------------------------------------------------------------- API
  setPlace(place: string, sub = '') {
    const day = game.save.day || 1;
    // only a new place (or a new day) is worth writing on the screen; the time of day is the sky's job
    if (place === this.placeName && day === this.dayShown) return;
    const firstOfDay = day !== this.dayShown;
    this.placeName = place;
    this.dayShown = day;
    const subTxt = firstOfDay && /day/i.test(sub) ? `Day ${day}` : '';
    this.place.innerHTML = `<b>${esc(place)}</b>${subTxt ? `<small>${esc(subTxt)}</small>` : ''}<span class="ul">${svgInk(100, 6, [{ d: underline(100, { seed: place.length }), c: '#fff4dc', w: 1.6, draw: 1 }], { stretch: true, w: '100%', h: '100%' })}</span>`;
    this.place.classList.remove('on');
    void this.place.offsetWidth;
    this.place.classList.add('on');
    this.placeT = 4.2;
  }
  setKeys(html: string) {
    this.keys.innerHTML = html;
    this.keys.classList.remove('gone');
    this.keysT = 6;
  }
  /** put the field laptop in the corner kit (null removes it); L opens it too */
  setLaptop(l: HudLaptop | null) { this.lap = l; this.refresh(); }
  show(on: boolean) { this.root.classList.toggle('off', !on); }

  /** backpack screen position (for flying pickups) */
  packPos(): [number, number] {
    const r = this.pack.getBoundingClientRect(), p = game.ui.root.getBoundingClientRect();
    if (!r.width) return [p.width * 0.06, p.height * 0.92];
    return [r.left - p.left + r.width / 2, r.top - p.top + r.height / 2];
  }
  bumpPack() {
    this.pack.classList.remove('bump');
    void this.pack.offsetWidth;
    this.pack.classList.add('bump');
  }

  /** big stamped note in the middle of the screen (a new place on the map...) */
  banner(title: string, sub = '') {
    const now = performance.now();
    if (now - this.bannerT < 600) return;
    this.bannerT = now;
    const b = el('div', 'hm-ban', `<div class="in" style="background-image:${paperTex('card')};clip-path:${edgeClip(title.length, { top: 'deckle', bottom: 'torn', left: 'deckle', right: 'deckle' })}"><div class="t">${stamp(title, { color: 'red', fresh: true, rot: '-2deg' })}</div>${sub ? `<div class="s pp-hand">${esc(sub)}</div>` : ''}</div>`);
    this.root.appendChild(b);
    setTimeout(() => paperSfx('stamp'), 140);
    setTimeout(() => b.remove(), 3500);
  }

  refresh(force = false) {
    const s = game.save;
    // the quest note
    const q = trackedQuest();
    let key = 'none';
    if (q) {
      const i = currentStepIndex(q);
      const pr = q.steps[i]?.progress?.();
      key = `${q.id}:${i}:${pr ? pr.join('/') : ''}`;
      if (key !== this.lastKey || force) {
        const sameQuest = q.id === this.lastQuest;
        const advanced = sameQuest && i > this.lastStep && this.lastStep >= 0;
        if (advanced) this.tickAndWrite(q, this.lastStep, i);
        else this.drawNote(q, i, !sameQuest && this.lastQuest !== '' && !force);
        if (!force && this.lastKey !== '' && (advanced || !sameQuest)) this.reveal(7);
        else if (!force && this.lastKey !== '') this.reveal(3.5);
        this.lastQuest = q.id;
        this.lastStep = i;
      }
    } else if (this.lastKey !== 'none') { this.q.classList.add('hid'); this.lastQuest = ''; this.lastStep = -1; }
    this.lastKey = key;
    this.peek.classList.toggle('on', !!q && this.showT <= 0);
    // the backpack: only says something when it's nearly full
    const n = s.inv.length, cap = Math.max(1, capacity());
    const full = n / cap >= 0.8;
    this.pack.classList.toggle('full', full);
    (this.pack.querySelector('.n') as HTMLElement).textContent = full ? `${n}/${cap}` : '';
    // the field laptop: there when something's waiting to be uploaded
    const on = !!this.lap?.shown();
    const badge = on ? this.lap!.badge() : 0;
    this.lapEl.classList.toggle('on', on && badge > 0);
    const nb = this.lapEl.querySelector('.badge') as HTMLElement;
    const txt = badge > 0 ? String(badge) : '';
    if (nb.textContent !== txt) nb.textContent = txt;
    nb.style.display = txt ? '' : 'none';
  }

  update(dt: number) {
    this.t += dt;
    const s = game.save;
    const sc = game.scene as SceneLike;
    const inp = game.input;
    const free = !game.ui.blocking && !sc?.cutscene;
    // research points come in as a stamp, then they're gone (the laptop and the blueprints keep count)
    if (s.rp > this.lastRp && this.lastRp >= 0) this.rpStamp(s.rp - this.lastRp);
    this.lastRp = s.rp;
    // keys: J journal, G encyclopedia, L laptop
    if (free && inp.keyHit('KeyJ')) this.openJournal();
    if (free && inp.keyHit('KeyG')) void this.openEncyclopedia();
    if (this.lap && inp.keyHit('KeyL') && free && this.lap.shown()) this.lap.open();
    // the note comes and goes
    const moving = inp.axisX() !== 0 || inp.down('jump');
    if (moving) { this.moved = true; this.idleT = 0; } else this.idleT += dt;
    if (this.showT > 0) {
      this.showT -= dt;
      if (this.showT <= 0 && !this.hover) this.q.classList.add('hid');
    }
    if (this.hover && this.showT < 0.5) this.showT = 0.5;
    // standing about for a while: a gentle reminder of what's next
    if (this.idleT > 24 && free) { this.idleT = -40; this.reveal(5); }
    // the controls line fades once you're on your way
    this.keysT -= dt;
    if ((this.keysT <= 0 || (this.moved && this.keysT < 4.5)) && !this.keys.classList.contains('gone')) this.keys.classList.add('gone');
    if (this.placeT > 0) { this.placeT -= dt; if (this.placeT <= 0) this.place.classList.remove('on'); }
    if (this.holdT > 0) { this.holdT -= dt; if (this.holdT <= 0) this.lastKey = ''; }
    if (this.t > 0.25) { this.t = 0; if (this.holdT <= 0) this.refresh(); }
    this.body?.update(dt);
  }

  /** icon flies from a screen point into the backpack, with a pencilled "+2 Flax" */
  flyItem(id: string, n: number, name: string, cssX: number, cssY: number) {
    const root = game.ui.root;
    const lab = el('div', 'pickup', `+${n} ${esc(name)}`);
    lab.style.left = cssX + 'px';
    lab.style.top = cssY + 'px';
    root.appendChild(lab);
    setTimeout(() => lab.remove(), 1400);
    const img = el('img', 'flyitem');
    img.src = itemIconURL(id, 3);
    img.style.left = cssX - 18 + 'px';
    img.style.top = cssY - 18 + 'px';
    root.appendChild(img);
    this.pack.style.opacity = '1';
    const [tx, ty] = this.packPos();
    const dx = tx - cssX, dy = ty - cssY;
    const anim = img.animate([
      { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
      { transform: `translate(${dx * 0.15}px, ${-40 + dy * 0.05}px) scale(1.25)`, opacity: 1, offset: 0.25 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.9 },
    ], { duration: 850, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => { img.remove(); this.bumpPack(); this.refresh(); setTimeout(() => { this.pack.style.opacity = ''; }, 900); };
  }

  destroy() {
    setQuestNotice(null);
    setTransitionFocus(null);
    if (this.swapT) clearTimeout(this.swapT);
    this.body?.destroy();
    this.root.remove();
  }

  // ---------------------------------------------------------------- the note
  private reveal(secs: number) {
    if (!trackedQuest()) return;
    this.showT = Math.max(this.showT, secs);
    this.q.classList.remove('hid');
    this.peek.classList.remove('on');
  }
  private noticeQuest(q: QuestDef) {
    // a new quest: the note shows it (with a little NEW stamp) for a moment, then goes back to the
    // tracked one if that's a different quest
    if (trackedQuest()?.id !== q.id) {
      this.drawNote(q, currentStepIndex(q), true);
      this.holdT = 5.5;
      this.lastKey = 'held';
    } else { this.lastKey = ''; this.refresh(); }
    this.qIn.insertAdjacentHTML('beforeend', `<span class="new-q">${stamp(q.main ? 'New' : 'New job', { color: 'red', fresh: true, rot: '10deg' })}</span>`);
    setTimeout(() => paperSfx('stamp', 0.6), 150);
    this.reveal(7);
  }
  private noteHtml(q: QuestDef, i: number, rows: string): string {
    const pr = q.steps[i]?.progress?.();
    return `${pin({ color: q.main ? 'red' : 'blue' })}<div class="ti pp-pix">${esc(q.title)}</div>${rows}${pr && i < q.steps.length ? `<div class="pr pp-hand">${tallyMarks(Math.min(pr[0], 20), Math.min(pr[1], 20), i + 3)}<span>${pr[0]}/${pr[1]}</span></div>` : ''}`;
  }
  private drawNote(q: QuestDef, i: number, slideIn: boolean) {
    const st = q.steps[i];
    const row = st ? `<div class="st">${checkbox('todo', i + 1)}<span class="tx pp-hand">${esc(st.text)}</span></div>` : `<div class="st">${checkbox('done', i + 1)}<span class="tx pp-hand">All done!</span></div>`;
    this.qIn.innerHTML = this.noteHtml(q, i, row);
    this.q.style.setProperty('--r', tilt(q.id, 2.5));
    this.qIn.style.transform = `rotate(${tilt(q.id, 1.6)})`;
    if (slideIn) paperSfx('slide', 0.6);
  }
  /** the step just finished gets ticked and struck through, then the next one is written in */
  private tickAndWrite(q: QuestDef, from: number, to: number) {
    const old = q.steps[from];
    if (this.swapT) clearTimeout(this.swapT);
    this.qIn.innerHTML = this.noteHtml(q, from, `<div class="st old">${checkbox('done', from + 1, true)}<span class="tx pp-hand">${struck(esc(old?.text ?? ''), from + 1, true)}</span></div>`);
    paperSfx('tick');
    audio.play('ui', { vol: 0.25, pitch: 1.4 });
    this.swapT = setTimeout(() => {
      this.swapT = null;
      if (trackedQuest()?.id !== q.id) return;
      const st = q.steps[to];
      this.qIn.innerHTML = this.noteHtml(q, to, `<div class="st old">${checkbox('done', from + 1)}<span class="tx pp-hand">${struck(esc(old?.text ?? ''), from + 1)}</span></div>`
        + (st ? `<div class="st new">${checkbox('todo', to + 1)}<span class="tx pp-hand">${esc(st.text)}</span></div>` : ''));
      paperSfx('pencil', 0.8);
      // after a moment only the new step stays
      this.swapT = setTimeout(() => { this.swapT = null; if (trackedQuest()?.id === q.id) this.drawNote(q, currentStepIndex(q), false); }, 3200);
    }, 1300);
  }
  private rpStamp(n: number) {
    const e = el('div', 'hm-rp', stamp(`+${n} RP`, { color: 'blue', fresh: true, rot: '-8deg' }));
    this.root.appendChild(e);
    setTimeout(() => paperSfx('stamp', 0.45), 100);
    setTimeout(() => e.remove(), 2700);
  }

  private openJournal() {
    if (game.ui.blocking) return;
    this.showT = 0;
    this.q.classList.add('hid');
    void import('./v11/journalbook').then(m => m.openJournal({ quest: trackedQuest()?.id }).then(() => { this.lastKey = ''; this.refresh(); this.reveal(3); }));
  }
  private async openEncyclopedia() {
    if (game.ui.blocking) return;
    const apps = await import('./v4/moriApps');
    if (!apps.installed('enc') && !apps.UNLOCK_BY_ID['enc']?.when()) {
      const who = (game.scene as unknown as { player?: { id?: string } } | null)?.player?.id ?? 'mori';
      game.ui.bubbles.bark(who, 'Nothing to look up yet. Get some photos uploaded first.', { expr: 'thinking' } as never);
      return;
    }
    const m = await import('./v11/encybook');
    await m.openEncyclopedia({});
  }
}

