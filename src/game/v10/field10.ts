// V10 expedition runtime: what every expedition scene gets on top of the V2 FieldScene. Exploring
// physically draws the map (every second the stretch around Mori is revealed), the ways deeper wait
// at the far ends (and a few side routes), finds can be photographed, looked at or collected, deep
// water is swum (energy), hazards and hard climbs cost energy, the camera draws photographed animals
// onto the map, events happen (events.ts), and M / the map button opens the Region Map.
// On the home island (the camp scene) it tracks the shore stretches, the ways inland from the beach,
// the trailhead signpost at camp and the short trips along the shore.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { Interactable } from '../../world/npc';
import type { RawPhoto } from '../photos';
import { SPECIES_BY_ID } from '../species';
import { Custom, Prop } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { el } from '../../ui/ui';
import { ITEMS } from '../items';
import { add, count, fits, remove } from '../inventory';
import { clamp, rand } from '../../core/math';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import {
  LOCATIONS, location, findLocation, isFound, revealMap, setLastPos, markRoute, discover, hasDiscovery, homeCost, islandLocAt, xRange, isIsland,
} from './regions';
import type { LocationDef, DiscoveryKind } from './regions';
import type { RouteDef } from './atlas';
import {
  arrivedAt, currentExpedition, goExpedition, returnToCamp, isIslandScene, isFieldScene, sceneTag, passTime, expeditionHour, clockText, CAMP_X, endTrip, effortSpend,
} from './expedition';
import { energy, spend } from './energy';
import { installTranslator, tr } from './translator';
import { bucket } from './store';
import type { Point10, Site10, Swim10, Hazard10 } from '../sites10/kit';
import { markerSprite, sprite, SWIM_DEPTH } from '../sites10/kit';
import { POINTS10 } from './finds';

/** the V10 day loop has started (the V4 story's Day 1 is over), or a debug flag */
export const v10Active = () => !!game.save.flags['v4:day1'] || !!game.save.flags['v10'];

const V2_LOC: Record<string, string> = { fernwood: 'fernwood', canopy: 'canopy', falls: 'falls', mangrove: 'mangrove', coast: 'coast' };
/** which location a field scene plays */
export function locOf(f: FieldScene): string | null {
  const t = sceneTag(f) ?? sceneTag(f.site) ?? (f.site as unknown as Site10).loc;
  if (t) return t;
  if (f.site.underwater && f.site.id === 'coast') return 'deep';
  return V2_LOC[f.site.id] ?? null;
}

const translatorOn = () => currentExpedition() !== null || (isFieldScene(game.scene) && !isIslandScene(game.scene));

interface Taken { taken: Record<string, number> }
const T = () => bucket<Taken>('finds', () => ({ taken: {} }));
/** unique finds (artifacts, fossils, one-of items) stay taken; samples and plants grow back the next day */
export const isTaken = (pt: Point10) => {
  const d = T().taken[pt.id];
  if (!d) return false;
  const unique = pt.kind === 'artifact' || pt.kind === 'fossil' || (ITEMS[pt.take?.item ?? '']?.stack ?? 2) <= 1;
  return unique || d === game.save.day;
};

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const fmtH = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h % 1 ? h.toFixed(1) : h} h`);

/** the runtime of the scene being played (events and the map read it) */
export let run: TripRun | null = null;

/** FieldScene.enter() hands every field scene here (the island too) */
export async function onFieldEnter(f: FieldScene) {
  installTranslator(translatorOn);
  run = null;
  if (isIslandScene(f)) { const ir = new IslandRun(f); run = ir; ir.start(); return; }
  const loc = locOf(f);
  if (!loc || !location(loc)) return;
  const r = new SiteRun(f, loc);
  run = r;
  await r.start();
}

// ================================================================== shared runtime
export abstract class TripRun {
  t = 0;
  protected revealT = 0;
  protected marks: { x: number; y: number }[] = [];
  /** event hooks: called every frame while the scene runs */
  tickers: ((dt: number) => void)[] = [];
  /** ways deeper an event has closed for this visit: to-location -> reason */
  blocked = new Map<string, string>();
  protected btn: HTMLElement | null = null;
  /** finds placed in this scene (and their ground y) */
  protected pts: { pt: Point10; x: number; y: number }[] = [];
  constructor(readonly f: FieldScene) {}
  /** place a find now (events use this for things that turn up) */
  addFind(pt: Point10) { this.addPoint(pt, this.pts); }
  abstract get loc(): string;
  get p() { return this.f.player; }
  get guide() { return this.f.guide?.a ?? null; }
  /** a line from Aroha through the translator (only when she's here) */
  aroha(text: string, expr = 'neutral', o: { whisper?: boolean; shout?: boolean } = {}) {
    return { who: 'aroha', ...tr(text, o), expr };
  }
  groundAt(x: number) { return this.f.st.terrain.surfaceBelow(x, -400)?.y ?? this.f.st.terrain.groundY(x); }

  protected installFrame(z = -60) {
    this.f.main.add(new Custom(z, rr => this.draw(rr), dt => this.update(dt)));
  }
  protected draw(rr: import('../../gfx/renderer').Renderer) {
    // a red flax ribbon over each way on, fluttering
    for (const m of this.marks) {
      const a = 0.4 + 0.3 * Math.sin(this.t * 3 + m.x);
      rr.fxDraw(A.spark, m.x + Math.sin(this.t * 1.3) * 2, m.y - 40, 0.6, 0.6, this.t, packColor(1, 0.8, 0.5, 1), a);
    }
  }
  protected update(dt: number) {
    this.t += dt;
    const inp = game.input;
    if (!this.f.cutscene && !game.ui.blocking && inp.keyHit('KeyM') && this.mapAllowed()) void this.openMap();
    for (const tk of this.tickers) tk(dt);
  }
  protected mapAllowed() { return true; }

  /** M / the map button: the Region Map (travel only from camp) */
  async openMap() {
    if (game.ui.blocking || this.f.cutscene) return;
    const atCamp = currentExpedition() === null && isIslandScene(this.f) && Math.abs(this.p.x - CAMP_X) < 700;
    const { openRegionMap } = await import('../../ui/v10/regionmap');
    game.paused = true;
    let to: string | null = null;
    try { to = await openRegionMap({ readOnly: !atCamp, here: { loc: this.loc, x: this.p.x } }); } finally { game.paused = false; }
    if (to && atCamp) await departFromCamp(to);
  }

  protected addMapButton() {
    if (!document.getElementById('v10-css')) document.head.appendChild(Object.assign(el('style', '', BTN_CSS), { id: 'v10-css' }));
    const b = el('div', 'v10-mapb interactive', `<i><img src="${mapIconURL()}" alt=""></i><span class="k">M</span><b class="t"></b>`);
    b.title = 'Region Map (M)';
    b.addEventListener('pointerdown', e => { e.stopPropagation(); void this.openMap(); });
    game.ui.sceneLayer.appendChild(b);
    this.btn = b;
  }
  protected setClock(text: string) {
    const t = this.btn?.querySelector('.t');
    if (t && t.textContent !== text) t.textContent = text;
  }

  /** photographed animals and finds go on the map */
  protected hookCamera(points: () => { pt: Point10; x: number; y: number }[]) {
    const cam = this.f.cam;
    if (!cam) return;
    const prev = cam.onShot;
    cam.onShot = (ph: RawPhoto) => { prev?.(ph); try { this.onPhoto(ph, points()); } catch (e) { console.warn('v10 photo', e); } };
  }
  private onPhoto(ph: RawPhoto, pts: { pt: Point10; x: number; y: number }[]) {
    const r = game.r, st = this.f.st;
    const F = this.f.cam.frameScreen();
    const fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    const drew: string[] = [];
    // animals: where the camera was pointing
    for (const s of ph.subjects) {
      if (s.visible < 0.3 || s.inFrame < 0.4 || s.size < 0.04) continue;
      const sp = SPECIES_BY_ID[s.species];
      const cx = (s.bbox[0] + s.bbox[2]) / 2;
      const wx = st.cam.x + ((F.x0 + cx * fw) - r.VW / 2) / st.cam.zoom;
      const loc = this.locAtX(wx);
      if (discover({ id: `sp:${s.species}@${loc}`, kind: 'species', name: sp?.name ?? s.species, loc, x: Math.round(wx), icon: s.species }, true)) drew.push(sp?.name ?? s.species);
    }
    // finds you can photograph
    for (const { pt, x, y } of pts) {
      if (!pt.photo || (pt.when && !pt.when())) continue;
      const dy = pt.photo.dy ?? 0;
      const x0 = r.projectX(x - pt.photo.w / 2, 1), x1 = r.projectX(x + pt.photo.w / 2, 1);
      const y0 = r.projectY(y - dy - pt.photo.h, 1), y1 = r.projectY(y - dy, 1);
      const ix = Math.max(0, Math.min(x1, F.x1) - Math.max(x0, F.x0)), iy = Math.max(0, Math.min(y1, F.y1) - Math.max(y0, F.y0));
      const area = Math.max(1, (x1 - x0) * (y1 - y0));
      const inFrame = (ix * iy) / area, big = Math.max((y1 - y0) / fh, (ix * iy) / (fw * fh));
      if (inFrame < 0.45 || big < 0.14) continue;
      ph.notes.push(`Photographed: ${pt.name}`);
      if (discover({ id: pt.id, kind: pt.kind, name: pt.name, loc: this.locAtX(x), x: Math.round(x), note: pt.note }, true)) drew.push(pt.name);
    }
    if (drew.length) {
      audio.play('pageTurn', { vol: 0.35 });
      game.ui.toast(`Map: sketched ${drew.slice(0, 3).map(d => `<b>${d}</b>`).join(', ')}${drew.length > 3 ? ` +${drew.length - 3}` : ''}.`, 'MAP', 'teal', 2800);
    }
  }
  protected locAtX(_x: number) { return this.loc; }

  // ---------------------------------------------------------------- finds
  protected addPoint(pt: Point10, list: { pt: Point10; x: number; y: number }[]) {
    const f = this.f;
    const y = pt.y ?? this.groundAt(pt.x);
    list.push({ pt, x: pt.x, y });
    const gone = () => !!pt.take && isTaken(pt);
    if (pt.art) {
      const c = sprite('pt:' + pt.id, pt.art);
      if (c) {
        const prop = new Prop(c.f, pt.x, y + 1, pt.z ?? 3);
        f.main.add(new Custom(pt.z ?? 3, (rr, st) => { if (!gone() && (!pt.when || pt.when())) prop.draw(rr, st); }));
        if (c.g) { const g = c.g; f.main.add(new Custom((pt.z ?? 3) + 0.1, rr => { if (gone() || (pt.when && !pt.when())) return; rr.emissive(1); rr.draw(g, pt.x, y + 1); rr.emissive(); })); }
      }
    }
    // an unfound find glints now and then
    f.main.add(new Custom(61, (rr, st) => {
      if (gone() || (pt.when && !pt.when()) || hasDiscovery(pt.id)) return;
      const k = Math.max(0, Math.sin(st.time * 1.9 + pt.x) - 0.6) / 0.4;
      if (k > 0) rr.fxDraw(A.spark, pt.x + Math.sin(st.time) * 3, y - 10 - (pt.photo?.h ?? 0) * 0.3, 0.7, 0.7, st.time, packColor(1, 0.95, 0.75, 1), 1.4 * k);
    }));
    if (!pt.take && !pt.look) return;
    const self = this;
    f.interact.push({
      x: pt.x, y, w: 16, h: 16, standX: pt.x - 14,
      get label() { return pt.take ? pt.take.verb : pt.look!.verb; },
      enabled: () => !gone() && (!pt.when || pt.when()),
      action: () => (pt.take ? self.take(pt) : self.look(pt)),
    } as Interactable);
  }

  private async look(pt: Point10) {
    const f = this.f;
    f.player.facing = pt.x >= f.player.x ? 1 : -1;
    // (Aroha only speaks when she came along)
    const lines = pt.look!.lines().filter(l => l.who !== 'aroha' || !!this.guide);
    if (lines.length) await f.say(lines);
    if (discover({ id: pt.id, kind: pt.kind, name: pt.name, loc: this.locAtX(pt.x), x: Math.round(pt.x), note: pt.note })) f.player.body.showEmote('idea', 1.2);
    pt.after?.();
  }

  private async take(pt: Point10) {
    const f = this.f, tk = pt.take!;
    const item = ITEMS[tk.item];
    if (!item) return;
    const miss = (tk.tools ?? []).filter(t => !game.save.tools.includes(t));
    if (miss.length) { audio.play('wrong', { vol: 0.5 }); f.bark('mori', `I need ${miss.map(m => `the ${ITEMS[m]?.name.toLowerCase() ?? m}`).join(' and ')} for this.`, { expr: 'thinking' }); return; }
    const n = tk.n ?? 1;
    if (!fits(tk.item, n)) { audio.play('wrong', { vol: 0.5 }); f.bark('mori', 'No room in the pack. Something has to go.', { expr: 'worried' }); return; }
    f.player.facing = pt.x >= f.player.x ? 1 : -1;
    const ok = await f.player.doWork('kneel', tk.time ?? 2, () => {});
    if (!ok) return;
    const got = add(tk.item, n);
    if (got <= 0) return;
    T().taken[pt.id] = game.save.day;
    const [cx, cy] = f.css(pt.x, (pt.y ?? this.groundAt(pt.x)) - 16);
    f.hud?.flyItem(tk.item, got, item.name, cx, cy);
    audio.play('collectPop' as never, { vol: 0.6 });
    const kind: DiscoveryKind = pt.kind;
    discover({ id: tk.item, kind, name: item.name, loc: this.locAtX(pt.x), x: Math.round(pt.x), note: pt.note, icon: tk.item }, true);
    if (pt.id !== tk.item) discover({ id: pt.id, kind, name: pt.name, loc: this.locAtX(pt.x), x: Math.round(pt.x), note: pt.note }, true);
    game.ui.toast(`Collected <b>${item.name}</b>${item.weight ? ` (${item.weight} kg)` : ''}. Noted on the map.`, 'FIND', 'teal', 3200);
    const lines = [];
    if (tk.line) lines.push({ who: 'mori', text: tk.line, expr: 'happy' });
    if (tk.aroha && this.guide) lines.push(this.aroha(tk.aroha, 'serious'));
    game.persist();
    f.hud?.refresh();
    if (lines.length) await f.say(lines as never);
    pt.after?.();
  }

  // ---------------------------------------------------------------- the ways deeper
  protected addRoute(to: LocationDef, r: RouteDef) {
    const f = this.f, self = this;
    const y = this.groundAt(r.at);
    this.marks.push({ x: r.at, y });
    const c = sprite('v10:marker', () => markerSprite());
    if (c) f.main.add(new Prop(c.f, r.at + 6, y + 1, 4));
    f.interact.push({
      x: r.at, y, w: 18, h: 26, standX: r.at - 8,
      get label() {
        const known = isFound(to.id);
        const name = known ? ` <b>to ${to.name}</b>` : '';
        const shut = self.blocked.get(to.id);
        return shut ? `${r.label} <span style="opacity:.75">(${shut})</span>` : `${r.label}${name} <span style="opacity:.75">· ${fmtH(r.hours)} · −${r.energy} energy${known ? '' : ' · unexplored'}</span>`;
      },
      quest: () => false,
      action: () => self.goDeeper(to, r),
    } as Interactable);
  }

  async goDeeper(to: LocationDef, r: RouteDef) {
    const f = this.f;
    if (f.cutscene) return;
    const shut = this.blocked.get(to.id);
    if (shut) { f.bark('mori', `No way through: ${shut}.`, { expr: 'worried' }); return; }
    if (r.flag && !game.save.flags[r.flag.id]) { audio.play('wrong', { vol: 0.5 }); await f.say([{ who: 'mori', text: r.flag.why, expr: 'thinking' }]); return; }
    if (r.needs && count(r.needs.item) < r.needs.n) { audio.play('wrong', { vol: 0.5 }); await f.say([{ who: 'mori', text: r.needs.why, expr: 'thinking' }]); return; }
    const tired = energy() <= r.energy + 2;
    const lines = [{ who: 'mori', text: r.say ?? 'Onward. Deeper.', expr: 'determined' as string, choices: [`Go on (−${r.energy} energy, ${fmtH(r.hours)})`, 'Not yet'] }];
    if (tired && this.guide) lines.unshift(this.aroha('You’re running on empty, Mori. If you go on now, I’ll be carrying you home.', 'worried') as never);
    const pick = await f.say(lines as never);
    if (pick !== 0) return;
    f.cutscene = true;
    try {
      // walk off into the way on
      f.cam?.raise(false);
      const dir = r.at > f.player.x ? 1 : -1;
      await Promise.race([f.player.walkTo(clamp(r.at + dir * 30, f.player.minX, f.player.maxX), 60), sleep(1500)]);
      if (r.needs) remove(r.needs.item, r.needs.n);
      effortSpend(r.energy, 'route');
      if (energy() <= 0) return; // the blackout takes it from here
      await goExpedition(to.id, { route: r, from: this.loc });
    } finally {
      if (game.scene === f) f.cutscene = false;
    }
  }
}

// ================================================================== a site (V2 or V10)
class SiteRun extends TripRun {
  private swims: Swim10[] = [];
  private hazards: (Hazard10 & { t: number; hit: number; warned: boolean })[] = [];
  private hard: { x: number; rate: number }[] = [];
  private swimming = false;
  private drainT = 0;
  private lastY = 0;
  private dark = 0;
  constructor(f: FieldScene, readonly locId: string) { super(f); }
  get loc() { return this.locId; }
  get L() { return location(this.locId)!; }

  async start() {
    const f = this.f, L = this.L;
    const pend = arrivedAt(L.id);
    if (pend) markRoute(pend.from, pend.to);
    if (findLocation(L.id)) {
      setTimeout(() => { if (game.scene === f) { f.hud?.banner('NEW PLACE ON THE MAP', `${L.name}${L.sub ? ' · ' + L.sub : ''} is now a fast-travel point`); audio.play('discover'); } }, 3800);
    }
    for (const to of LOCATIONS) for (const r of to.routes ?? []) if (r.from === L.id) this.addRoute(to, r);
    this.fixHomeExit();
    // finds
    const ex = (f.site as unknown as Site10).v10;
    for (const pt of [...(POINTS10[L.id] ?? []), ...(ex?.points ?? [])]) this.addPoint(pt, this.pts);
    this.swims = ex?.swims ?? [];
    this.hazards = (ex?.hazards ?? []).map(h => ({ ...h, t: rand.range(0, h.period ?? 4), hit: 0, warned: false }));
    this.hard = ex?.hardClimbs ?? [];
    this.dark = ex?.dark ?? 0;
    this.hookCamera(() => this.pts);
    this.addMapButton();
    this.installFrame();
    revealMap(L.id, f.player.x - 160, f.player.x + 160);
    const { startEvents } = await import('./events');
    startEvents(this);
  }

  /** "Head back to camp" says how far it is */
  private fixHomeExit() {
    const it = this.f.interact.find(i => i.label === 'Head back to camp');
    if (!it) return;
    const loc = this.locId, f = this.f;
    Object.defineProperty(it, 'label', { configurable: true, get: () => { const h = homeCost(loc, f.player.x); return `Head back to camp <span style="opacity:.75">· ${fmtH(h.hours)} walk · −${h.energy} energy</span>`; } });
  }

  protected draw(rr: import('../../gfx/renderer').Renderer) {
    super.draw(rr);
    // in the dark, a soft glow travels with Mori (his headlamp on low, the camera's screen)
    if (this.dark > 0) {
      const p = this.p, lamp = game.save.tools.includes('headlamp') ? 1 : 0.6;
      rr.light(p.x + p.facing * 6, p.y - 34, 120, 1, 0.92, 0.78, 0.7 * this.dark * lamp, 0.12);
      if (this.f.guide) rr.light(this.f.guide.a.x, this.f.guide.a.y - 30, 70, 1, 0.85, 0.7, 0.3 * this.dark, 0.1);
    }
  }

  protected update(dt: number) {
    super.update(dt);
    const f = this.f, p = this.p;
    if (!f.cutscene && !game.ui.blocking) passTime(dt / 180);
    this.revealT -= dt;
    if (this.revealT <= 0) {
      this.revealT = 1;
      revealMap(this.locId, p.x - 160, p.x + 160);
      setLastPos(this.locId, p.x);
      this.setClock(clockText(expeditionHour()));
    }
    if (f.cutscene || game.ui.blocking) return;
    this.updateSwim(dt);
    this.updateHazards(dt);
    // hard climbs (on top of the energy module's climbing cost): arms and legs burn
    if (p.state === 'climb' && p.climb && Math.abs(p.vy) + Math.abs(p.y - this.lastY) > 0.01) {
      const h = this.hard.find(c => Math.abs(c.x - p.climb!.x) < 3);
      if (h) this.drain(h.rate * dt, 'hard climb');
    }
    this.lastY = p.y;
  }

  private drain(n: number, why: string) {
    this.drainT += n;
    if (this.drainT >= 1) { const k = Math.floor(this.drainT); this.drainT -= k; spend(k, why); }
  }

  private updateSwim(dt: number) {
    const p = this.p, f = this.f;
    const sw = this.swims.find(s => p.x > s.x0 + 2 && p.x < s.x1 - 2 && p.y > s.top + 2 && p.y < s.top + SWIM_DEPTH + 10);
    if (sw) {
      if (!this.swimming) {
        this.swimming = true;
        f.splash(p.x, sw.top, 1);
        p.ground = 'water';
        if (f.cam?.active) f.cam.raise(false);
        if (!game.save.flags['v10:swum']) { game.save.flags['v10:swum'] = true; f.bark('mori', 'Swimming with a camera bag. Hold it up, hold it up...', { expr: 'worried' }); }
      }
      if (f.cam?.active) { f.cam.raise(false); f.bark('mori', 'Not while I’m swimming!', { expr: 'worried' }); }
      p.poseOverride = 'swim';
      p.wadeK = 0.55;
      if (sw.cold) this.drain(dt * 0.5, 'cold water');
      if (rand.chance(dt * (Math.abs(p.vx) > 5 ? 6 : 1.5))) f.main.particles.spawn({ frame: A.dot2, x: p.x + rand.range(-8, 8), y: sw.top, vx: rand.range(-20, 20), vy: rand.range(-30, -10), ay: 160, life: 0.5, color: [0.85, 0.95, 1], alpha: 0.8, alpha1: 0, floorY: sw.top + 1 });
    } else if (this.swimming) {
      this.swimming = false;
      if (p.poseOverride === 'swim') p.poseOverride = null;
      p.wadeK = 1;
      p.ground = this.f.site.ground ?? 'leaves';
      f.splash(p.x, p.y, 0.6);
    }
  }

  private updateHazards(dt: number) {
    const p = this.p, f = this.f;
    for (const h of this.hazards) {
      h.t -= dt;
      h.hit -= dt;
      const inside = p.x > h.x0 && p.x < h.x1;
      if (!h.warned && Math.abs(p.x - (h.x0 + h.x1) / 2) < (h.x1 - h.x0) / 2 + 120) {
        h.warned = true;
        if (h.warn && this.guide) void f.say([this.aroha(h.warn, 'serious', { whisper: true }) as never]);
      }
      switch (h.kind) {
        case 'thorns': case 'mud':
          if (inside) { p.wadeK = Math.min(p.wadeK, h.kind === 'mud' ? 0.45 : 0.6); this.drain(h.dmg * dt, h.kind); if (h.hit <= 0) { h.hit = 6; f.bark('mori', h.kind === 'mud' ? 'Ugh. It’s like wading through porridge.' : 'Ow. Ow. OW. Thorns.', { expr: 'worried' }); } }
          else if (p.wadeK < 1 && !this.swimming) p.wadeK = 1;
          break;
        case 'slip':
          if (inside && p.running && p.onGround) { p.vx -= Math.sign(p.vx || 1) * 260 * dt; if (h.hit <= 0) { h.hit = 5; f.st.shake(1, 0.2); audio.play('rustle', { vol: 0.5 }); this.drain(h.dmg, 'slip'); f.bark('mori', 'Whoa! Loose rock! Slowly does it.', { expr: 'scared' }); } }
          break;
        case 'scald': case 'spores': case 'rockfall': {
          const period = h.period ?? 5;
          if (h.t <= 0) {
            h.t = period * rand.range(0.7, 1.3);
            const x = h.kind === 'rockfall' ? clamp(p.x + rand.range(-60, 60), h.x0, h.x1) : rand.range(h.x0, h.x1);
            void this.burst(h, x);
          }
          break;
        }
      }
    }
  }

  /** a vent blows, a spore puff, a rock falls: telegraphed, then it hurts if Mori is under it */
  private async burst(h: Hazard10 & { hit: number }, x: number) {
    const f = this.f, gy = this.groundAt(x), lp = f.main.particles;
    const warn = h.kind === 'rockfall' ? 0.9 : 1.1;
    // telegraph
    if (h.kind === 'rockfall') {
      f.sfx('rustle', x, 0.5, 0.6);
      for (let i = 0; i < 6; i++) lp.spawn({ frame: A.dot2, x: x + rand.range(-6, 6), y: gy - 220, vx: rand.range(-5, 5), vy: rand.range(30, 60), ay: 300, life: 0.8, color: [0.6, 0.55, 0.45], alpha: 0.9, alpha1: 0.4, floorY: gy });
    } else {
      f.sfx('hiss', x, 0.35, h.kind === 'spores' ? 1.6 : 0.8);
      for (let i = 0; i < 5; i++) lp.spawn({ frame: A.soft, x: x + rand.range(-4, 4), y: gy - 2, vx: rand.range(-3, 3), vy: rand.range(-12, -6), life: 0.9, color: h.kind === 'spores' ? [0.7, 1, 0.8] : [0.95, 0.95, 0.95], alpha: 0.35, alpha1: 0, size: 0.3, size1: 0.6 });
    }
    await sleep(warn * 1000);
    if (game.scene !== f) return;
    // the event
    const reach = h.kind === 'rockfall' ? 16 : 26;
    if (h.kind === 'rockfall') {
      f.sfx('land', x, 0.8, 0.7);
      f.st.shake(2, 0.25);
      for (let i = 0; i < 10; i++) lp.spawn({ frame: A.dot2, x: x + rand.range(-8, 8), y: gy - 2, vx: rand.range(-60, 60), vy: rand.range(-80, -20), ay: 300, life: 0.8, color: [0.55, 0.5, 0.42], alpha: 1, alpha1: 0.2, floorY: gy + 1 });
    } else {
      f.sfx(h.kind === 'spores' ? 'gust' : 'hiss', x, 0.7, h.kind === 'spores' ? 1.4 : 0.6);
      const col: [number, number, number] = h.kind === 'spores' ? [0.55, 1, 0.75] : [1, 1, 1];
      for (let i = 0; i < 24; i++) (h.kind === 'spores' ? f.main.glowParticles : lp).spawn({ frame: h.kind === 'spores' ? A.dot : A.soft, x: x + rand.range(-8, 8), y: gy - 4, vx: rand.range(-18, 18), vy: rand.range(-80, -30), life: rand.range(1, 2), color: col, alpha: h.kind === 'spores' ? 1 : 0.45, alpha1: 0, size: 0.5, size1: 1.8, glow: h.kind === 'spores', intensity: 1.4, wobble: 6, wobbleF: 1.5 });
    }
    const p = this.p;
    if (Math.abs(p.x - x) < reach && p.y > gy - 40 && h.hit <= 0 && !f.cutscene) {
      h.hit = 2;
      p.hurtT = 1;
      p.vx = -Math.sign(x - p.x || 1) * 120;
      p.vy = -70;
      p.onGround = false;
      p.body.setExpr('scared', 1.5);
      audio.play('alert', { vol: 0.5 });
      spend(h.dmg, h.kind);
      const say = h.kind === 'scald' ? 'HOT! Hot hot hot!' : h.kind === 'spores' ? '*cough* *cough* ...it tastes like mushrooms.' : 'OW! That rock nearly took my head off!';
      f.bark('mori', say, { expr: 'scared' });
      game.ui.toast(`−${h.dmg} energy`, h.kind === 'scald' ? 'BURN' : h.kind === 'spores' ? 'SPORES' : 'ROCKFALL', 'coral', 1800);
    }
  }
}

// ================================================================== the home island (camp + the shore)
class IslandRun extends TripRun {
  private zone = 'camp';
  private tripT = 0;
  private zoneT = 0;
  get loc() { return this.zone; }
  protected locAtX(x: number) { return islandLocAt(x); }
  protected mapAllowed() { return v10Active(); }

  start() {
    const f = this.f;
    this.zone = islandLocAt(f.player.x);
    if (currentExpedition() && isIsland(location(currentExpedition()!))) arrivedAt(currentExpedition()!);
    else if (currentExpedition()) {
      // came home some other way (a reload mid-trip): the trip is over
    }
    for (const L of LOCATIONS) if (isIsland(L)) for (const pt of POINTS10[L.id] ?? []) this.addPoint(pt, this.pts);
    this.hookCamera(() => this.pts);
    if (v10Active()) {
      for (const to of LOCATIONS) for (const r of to.routes ?? []) { const from = location(r.from); if (from && isIsland(from)) this.addRoute(to, r); }
      if (TRAILHEAD.on) this.addTrailhead();
      this.addMapButton();
    }
    this.installFrame();
  }

  /** the signpost at the east end of camp: plan an expedition on the Region Map */
  private addTrailhead() {
    const f = this.f, x = TRAILHEAD.x, y = this.groundAt(x);
    const c = sprite('v10:signpost', signpostSprite);
    if (c) f.main.add(new Prop(c.f, x, y + 2, -2.4));
    f.interact.push({
      x, y, w: 18, h: 30, standX: x - 16,
      label: 'Trailhead: plan an expedition <span style="opacity:.75">(Region Map)</span>',
      enabled: () => TRAILHEAD.on && currentExpedition() === null,
      action: async () => {
        const { openRegionMap } = await import('../../ui/v10/regionmap');
        game.paused = true;
        let to: string | null = null;
        try { to = await openRegionMap({ here: { loc: 'camp', x: f.player.x } }); } finally { game.paused = false; }
        if (to) await departFromCamp(to);
      },
    } as Interactable);
  }

  protected update(dt: number) {
    super.update(dt);
    const f = this.f, p = this.p;
    this.revealT -= dt;
    this.zoneT -= dt;
    if (this.revealT <= 0) {
      this.revealT = 1;
      for (const L of LOCATIONS) {
        if (!isIsland(L)) continue;
        const [a, b] = xRange(L);
        if (p.x + 180 > a && p.x - 180 < b) revealMap(L.id, p.x - 180, p.x + 180);
      }
      setLastPos(islandLocAt(p.x), p.x);
      if (v10Active()) this.setClock(currentExpedition() ? clockText(expeditionHour()) : 'Camp');
    }
    const z = islandLocAt(p.x);
    if (z !== this.zone) { this.zone = z; this.zoneT = 1.2; }
    // a stretch of shore counts as found once Mori has really been there for a moment
    if (this.zoneT <= 0 && !f.cutscene && !game.ui.blocking && !isFound(z) && findLocation(z)) game.ui.toast(`Map: <b>${location(z)?.name}</b> added.`, 'MAP', 'teal', 2400);
    if (!v10Active() || !ISLAND_TRIPS.auto) return;
    // short trips along the shore: out past the palms or the wreck is an expedition; back into camp ends it
    const cur = currentExpedition();
    if (!cur && !f.cutscene && (p.x > 2680 || p.x < 1330) && !game.ui.blocking) { arrivedAt(z); this.tripT = 0; }
    if (cur && isIsland(location(cur))) {
      this.tripT += dt;
      if (!f.cutscene && !game.ui.blocking) passTime(dt / 180);
      if (z !== cur && z !== 'camp') arrivedAt(z);
      if (ISLAND_TRIPS.end && p.x > 1520 && p.x < 2300 && !f.cutscene && !game.ui.blocking && p.state === 'normal') {
        if (this.tripT > 20) void returnToCamp('walk');
        else endTrip();
      }
    }
  }
}

/** a trailhead signpost of this module's own (off: the camp module's trail sign opens the map) */
export const TRAILHEAD = { x: 2420, on: false };
/** walking out of camp along the shore starts a short trip (the camp module ends it when Mori walks
 *  back into camp; `end` lets this module end it too) */
export const ISLAND_TRIPS = { auto: true, end: true };

/** leave camp for a location picked on the map (fast travel along the known trail) */
export async function departFromCamp(to: string) {
  const L = location(to);
  if (!L) return;
  if (to === 'camp') return;
  const sc = game.scene;
  if (isFieldScene(sc) && L.scene.type !== 'island' && (sc.guide || sc.actors.get('aroha')?.visible) && game.save.flags['v4:arohaJoined']) {
    void sc.say([{ who: 'aroha', ...tr(`${L.name}? Kia tūpato. Pack light, and we go.`), expr: 'determined' } as never]);
    await sleep(900);
  }
  await goExpedition(to);
}

// ------------------------------------------------------------------ art & css
let mapIcon = '';
function mapIconURL(): string {
  if (mapIcon) return mapIcon;
  const rows = [
    '................',
    '..kkkkk..kkkkk..',
    '.kPPPPkkkPPPPPk.',
    '.kPpPPkPkPPrPPk.',
    '.kPPpPkPkPrrrPk.',
    '.kPPPpkPkPPrPPk.',
    '.kpPPPkPkPPPPPk.',
    '.kPpPPkPkPPPgPk.',
    '.kPPpPkPkPPggPk.',
    '.kPPPPkPkPgggPk.',
    '.kPbbPkPkPPPPPk.',
    '.kPbbbkPkPPPPPk.',
    '.kPPPPkPkPPPPPk.',
    '.kkkkkkkkkkkkkk.',
    '................',
    '................',
  ];
  const col: Record<string, string> = { k: '#2a1408', P: '#f2e4bc', p: '#7a5a34', r: '#c8402e', g: '#5aa447', b: '#3a8ad8' };
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  rows.forEach((r, y) => { for (let x = 0; x < 16; x++) { const v = col[r[x]]; if (v) { g.fillStyle = v; g.fillRect(x * 3, y * 3, 3, 3); } } });
  mapIcon = c.toDataURL();
  return mapIcon;
}

function signpostSprite() {
  const b = new PixelBuffer(40, 54);
  const w0 = hex('#3a2414'), w1 = hex('#5a3a20'), w2 = hex('#7a5430'), w3 = hex('#9c7044');
  for (let y = 8; y < 54; y++) { b.set(19, y, w1); b.set(20, y, y % 6 === 0 ? w0 : w2); b.set(21, y, w1); }
  const arrow = (y: number, dir: 1 | -1, len: number, col = w3) => {
    const x0 = dir > 0 ? 18 : 22 - len;
    for (let yy = 0; yy < 7; yy++) for (let x = 0; x < len; x++) {
      const tip = dir > 0 ? len - x : x;
      if (tip < 4 && Math.abs(yy - 3) > tip) continue;
      b.set(x0 + x, y + yy, yy === 0 ? w3 : yy === 6 ? w0 : (x + yy) % 9 === 0 ? w1 : col);
    }
  };
  arrow(8, 1, 20);
  arrow(17, -1, 18, hex('#8a6038'));
  arrow(26, 1, 15, hex('#94683c'));
  // a red flax ribbon and a little map pinned to it
  b.rect(22, 36, 6, 7, hex('#f2e4bc'));
  b.rect(23, 38, 2, 1, hex('#c8402e')); b.rect(25, 40, 2, 1, hex('#5aa447'));
  for (let i = 0; i < 6; i++) b.set(17 - i * 0.5, 34 + i, hex('#c8402e'));
  b.outline(hex('#140c08'));
  return { buf: b, ax: 20, ay: 53 };
}

const BTN_CSS = `
.v10-mapb { position: absolute; left: 16px; top: 6.3em; display: flex; align-items: center; gap: 0.45em; padding: 4px 0.7em 4px 4px; cursor: pointer; pointer-events: auto;
  background: linear-gradient(#6a3e1c, #4a2a12); box-shadow: 0 0 0 2px #1a0e06, 0 0 0 4px #e0a818, 0 0 0 6px #1a0e06, 0 5px 0 5px rgba(0,0,0,0.3); transition: transform 0.12s; z-index: 2; }
.v10-mapb:hover { transform: translateY(-2px); filter: brightness(1.1); }
.v10-mapb i { width: 2.6em; height: 2.6em; background: var(--sk-slot) center / 100% 100%; image-rendering: pixelated; display: grid; place-items: center; }
.v10-mapb i img { width: 1.9em; height: 1.9em; image-rendering: pixelated; filter: drop-shadow(0 2px 0 rgba(0,0,0,0.45)); }
.v10-mapb .k { position: absolute; left: 3px; top: 0; font-family: var(--head); font-size: 0.72em; color: #ffe9a8; text-shadow: 0 2px 0 #1a0e06, 1px 0 0 #1a0e06, -1px 0 0 #1a0e06; }
.v10-mapb .t { font-family: var(--head); font-size: 0.95em; color: #ffe9a8; letter-spacing: 0.05em; text-shadow: 0 2px 0 #1a0e06; min-width: 2.6em; }
`;
