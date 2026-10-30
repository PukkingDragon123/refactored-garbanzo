// The classic HUD is back (CLASSIC_HUD): the objective note, research stamp, pocket-watch clock, place
// banner, kit and status plate are src/ui/v11/hud2classic.ts, and this class forwards to it. With
// CLASSIC_HUD off it is the V12 no-HUD below.
// V12: no HUD. There is no status plate, quest note, corner kit, film counter, research stamp, place
// banner or controls line on screen any more; what the player needs is in the world or on Mori (inspect
// him for the camera, the backpack and the notebook). Hud2 keeps the V2 API (setPlace, setKeys,
// setLaptop, show, refresh, update, flyItem, banner, packPos, bumpPack, destroy) so every scene works,
// and turns its moments into floating text:
//   setPlace   the area's name floats big in the sky when you arrive somewhere new
//   flyItem    "+2 Flax" with the item's icon rises off the spot it was picked up
//   banner     a notice near Mori
//   research   "+15" research points float up near Mori
//   quests     a new job or the next step is a notice near Mori; the finished step gets its pen tick
//              in the notebook next time it's opened
// It also keeps the keys it owned: J the notebook, G the field guide, L the field laptop.
// The time of day is not shown here any more (the old sun-and-moon dial is gone): when a time or a
// countdown has to be shown, it's the brass pocket watch (src/ui/v12/watch.ts, the loop module's).
// (the loop module opens the watch: setting off, at the dusk radio calls, reading a signpost, a late
// refusal, every QTE time limit, and floatChoices({ watch: true }) for a timed answer)

import { el } from './ui';
import { game } from '../game/game';
import { trackedQuest, currentStepIndex, setQuestNotice } from '../game/quests';
import type { QuestDef } from '../game/quests';
import { itemIcon } from '../art/itemicons';
import { setTransitionFocus } from './v11/paper';
import { floatSky, floatNotice, floatPickup, moriAnchor } from './v12/float';
import { markQuestDone } from './v12/notebook';
import { Hud2Classic } from './v11/hud2classic';
import { setBodyHud } from './v10/bodyhud';

/** the objective note, research stamp, clock, place banner, kit and status plate on screen */
export const CLASSIC_HUD = true;

/** the island's field laptop on the belt (see game/v9/research9.ts) */
export interface HudLaptop {
  shown: () => boolean;
  /** photos waiting on the camera */
  badge: () => number;
  open: () => void;
}

export interface HudOpts {
  place: string;
  sub?: string;
  keys?: string;
  onBackpack?: () => void;
}

type SceneLike = { player?: { x: number; y: number }; cutscene?: boolean; st?: { cam: { x: number; y: number; zoom: number } } } | null;

/** the last place named in the sky (so a scene change back to the same place stays quiet), and when
 *  each place was last named (walking back and forth over a boundary doesn't repeat it) */
let lastPlace = '';
let lastDay = -1;
const namedAt = new Map<string, number>();
/** the controls, once per session on a keyboard: keycaps floating near Mori, then gone */
let hinted = false;

export class Hud2 {
  /** an empty, never-shown element (kept for the V2 API) */
  readonly root: HTMLElement;
  private lap: HudLaptop | null = null;
  private onBackpack?: () => void;
  private lastRp = -1;
  private lastQuest = '';
  private lastStep = -1;
  private holdT = 0;
  private acc = 0;
  private bannerT = 0;
  private classic: Hud2Classic | null = null;

  constructor(parent: HTMLElement, o: HudOpts) {
    if (CLASSIC_HUD) {
      setBodyHud('auto');
      this.classic = new Hud2Classic(parent, o);
      this.root = this.classic.root;
      this.lastRp = game.save.rp;
      return;
    }
    this.root = parent.appendChild(el('div', 'h2'));
    this.root.style.display = 'none';
    this.onBackpack = o.onBackpack;
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
    this.setPlace(o.place, o.sub);
    this.refresh(true);
    if (!hinted) {
      hinted = true;
      const show = (n: number) => setTimeout(() => {
        if (document.body.classList.contains('touchmode')) return;
        const sc = game.scene as SceneLike;
        if (game.ui.blocking || sc?.cutscene) { if (n < 20) show(n + 1); return; }
        floatNotice('<span class="key">A</span><span class="key">D</span> walk  <span class="key">E</span> use  <span class="key">Tab</span> or click Mori: his kit', 5200);
      }, 2600);
      show(0);
    }
  }

  // ---------------------------------------------------------------- API
  /** a new place (or a new day): its name floats in the sky for a moment */
  setPlace(place: string, sub = '') {
    if (this.classic) return this.classic.setPlace(place, sub);
    const day = game.save.day || 1;
    if (place === lastPlace && day === lastDay) return;
    const newDay = day !== lastDay && lastDay >= 0 && /day/i.test(sub);
    lastPlace = place;
    lastDay = day;
    if (!place) return;
    const now = performance.now(), was = namedAt.get(place + '|' + day);
    if (was !== undefined && now - was < 150000 && !newDay) return;
    namedAt.set(place + '|' + day, now);
    void floatSky(place, '', newDay ? `Day ${day}` : '', 2400, { soft: true });
  }
  /** (the controls line is gone) */
  setKeys(html: string) { this.classic?.setKeys(html); }
  /** the field laptop on Mori's belt: L opens it */
  setLaptop(l: HudLaptop | null) { this.lap = l; this.classic?.setLaptop(l); }
  /** (nothing to show or hide) */
  show(on: boolean) { this.classic?.show(on); }

  /** Mori's backpack on screen (for things flying into it), relative to the UI root */
  packPos(): [number, number] {
    if (this.classic) return this.classic.packPos();
    const a = moriAnchor()();
    if (a) return [a[0], a[1] + 30];
    const p = game.ui.root.getBoundingClientRect();
    return [p.width * 0.5, p.height * 0.7];
  }
  bumpPack() { this.classic?.bumpPack(); }

  /** a big moment ("NEW PLACE ON THE MAP"): a notice near Mori */
  banner(title: string, sub = '') {
    if (this.classic) return this.classic.banner(title, sub);
    const now = performance.now();
    if (now - this.bannerT < 600) return;
    this.bannerT = now;
    floatNotice(sub || title, 3800, sub ? { tag: title, accent: '#ffd05a' } : {});
  }

  /** watch the tracked quest: a finished step gets its pen tick in the notebook and the next one floats up */
  refresh(force = false) {
    this.classic?.refresh(force);
    const q = trackedQuest();
    if (!q) { this.lastQuest = ''; this.lastStep = -1; return; }
    const i = currentStepIndex(q);
    if (force || this.holdT > 0) { this.lastQuest = q.id; this.lastStep = i; return; }
    if (q.id === this.lastQuest && i > this.lastStep && this.lastStep >= 0) {
      for (let k = this.lastStep; k < i; k++) markQuestDone(q.id, k);
      const st = q.steps[i];
      if (!this.classic) floatNotice(st ? st.text : 'All done!', 3600, { tag: st ? 'Next' : 'Done', accent: '#9ff0dc' });
    }
    this.lastQuest = q.id;
    this.lastStep = i;
  }

  update(dt: number) {
    if (this.classic) {
      this.classic.update(dt);
      this.acc += dt;
      if (this.acc >= 0.25) { this.acc = 0; this.refresh(); }
      return;
    }
    const s = game.save;
    const sc = game.scene as SceneLike;
    const inp = game.input;
    const free = !game.ui.blocking && !sc?.cutscene;
    // research points float up near Mori
    if (s.rp > this.lastRp && this.lastRp >= 0) floatNotice(`+${s.rp - this.lastRp} research`, 2400, { tag: 'RP', accent: '#9fc8ff' });
    this.lastRp = s.rp;
    // keys: J the notebook, G the field guide, L the field laptop
    if (free && inp.keyHit('KeyJ')) this.openJournal();
    if (free && inp.keyHit('KeyG')) void this.openEncyclopedia();
    if (this.lap && inp.keyHit('KeyL') && free && this.lap.shown()) this.lap.open();
    if (this.holdT > 0) this.holdT -= dt;
    this.acc += dt;
    if (this.acc >= 0.25) { this.acc = 0; this.refresh(); }
  }

  /** "+2 Flax" with the item's icon, rising off the spot it was picked up */
  flyItem(id: string, n: number, name: string, cssX: number, cssY: number) {
    if (this.classic) { this.classic.flyItem(id, n, name, cssX, cssY); this.refresh(); return; }
    let buf = null;
    try { buf = itemIcon(id); } catch { buf = null; }
    floatPickup(`+${n} ${name}`, cssX, cssY, buf ? { key: id, buf } : null);
    this.refresh();
  }

  destroy() {
    if (this.classic) { this.classic.destroy(); return; }
    setQuestNotice(null);
    setTransitionFocus(null);
    this.root.remove();
  }

  // ---------------------------------------------------------------- moments
  private noticeQuest(q: QuestDef) {
    floatNotice(q.title, 3800, { tag: q.main ? 'New' : 'New job', accent: '#ffd05a' });
    // hold the step watcher a moment so the new quest isn't also announced as a step
    this.holdT = 1;
  }

  private openJournal() {
    if (game.ui.blocking) return;
    void import('./v12/notebook').then(m => m.openNotebook({ quest: trackedQuest()?.id ?? undefined }));
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
