// WorldScene: base for every V2 side-scrolling scene (boat, beach camp, tent, jungle, sites).
// Owns the stage, the player, actors (who can speak in bubbles), interactables, resource nodes,
// the V2 HUD and the collecting flow; keeps quests ticking.

import { openPause } from '../../ui/pause';
import type { Renderer } from '../../gfx/renderer';
import type { Scene } from '../game';
import { game } from '../game';
import { Stage, Layer } from '../../world/stage';
import { Player } from '../../world/player';
import { Actor, CHAR_NAMES } from '../../world/actor';
import { Interactable, PromptView, nearestInteractable } from '../../world/npc';
import { ResourceNode } from '../../world/resources';
import { Hud2, HudOpts } from '../../ui/hud2';
import type { BubbleLine } from '../../ui/bubbles';
import { audio } from '../../core/audio';
import { ITEMS, isSample } from '../items';
import { add, fits } from '../inventory';
import { perks } from '../skills';
import { updateQuests } from '../quests';
import { addClue } from '../research';
import { CLUE_BY_ID } from '../species';
import { openBackpack } from '../../ui/backpack';
import { A } from '../assets';
import { rand } from '../../core/math';

export abstract class WorldScene implements Scene {
  st!: Stage;
  player!: Player;
  main!: Layer;
  actors = new Map<string, Actor>();
  interact: Interactable[] = [];
  /** extra quest targets that aren't interactables ("run to the engine room") */
  questPoints: { x: () => number; y: () => number; on: () => boolean }[] = [];
  private marks: QuestMarks | null = null;
  nodes: ResourceNode[] = [];
  prompt!: PromptView;
  hud: Hud2 | null = null;
  cutscene = false;
  lookAhead = 40;
  camY = 180;
  clickToWalk = true;
  pausable = true;
  private busyAction = false;
  hovered: Interactable | null = null;
  /** nearest interactable in reach this frame (touch controls label the Use button with it) */
  nearIt: Interactable | null = null;
  /** night: some nodes only appear after dark */
  night = false;
  /** allow opening the backpack */
  allowPack = true;

  abstract build(): void | Promise<void>;
  private readyRes: (() => void) | null = null;
  /** resolves once the scene is built and can be shown (see Game.enterScene) */
  readonly readyP = new Promise<void>(r => (this.readyRes = r));

  hudOpts(): HudOpts | null {
    return null;
  }

  async enter() {
    this.prompt = new PromptView(game.ui.prompts);
    await this.build();
    const b = game.ui.bubbles;
    const pn = CHAR_NAMES[this.player.id] ?? 'Mori';
    b.register(this.player.id, this.player.body.speaker(pn));
    b.register('rowan', this.player.body.speaker(pn));
    this.player.body.layer = this.main;
    for (const [id, a] of this.actors) b.register(id, a.speaker());
    const ho = this.hudOpts();
    if (ho) this.hud = new Hud2(game.ui.sceneLayer, { ...ho, onBackpack: () => this.openPack() });
    this.snapCamera();
    this.readyRes?.();
  }

  snapCamera() {
    const c = this.st.cam;
    c.x = c.tx = this.player.x;
    c.y = c.ty = this.camY;
  }

  /** Add an NPC actor on a layer (default main) and register it as a speaker. */
  addActor(id: string, x: number, y: number, facing = -1, layer = this.main): Actor {
    const a = new Actor(id, x, y, facing);
    a.layer = layer;
    a.terrain = this.st.terrain;
    layer.add(a);
    this.actors.set(id, a);
    game.ui.bubbles.register(id, a.speaker());
    return a;
  }
  actor(id: string): Actor {
    return id === 'rowan' || id === this.player.id ? this.player.body : this.actors.get(id)!;
  }

  say(lines: BubbleLine[]) {
    return game.ui.bubbles.say(lines);
  }
  bark(who: string, text: string, o: { expr?: string; emote?: string } = {}) {
    game.ui.bubbles.bark(who, text, o);
  }

  worldMouse() {
    const r = game.r, c = this.st.cam;
    return [(game.input.mx - r.VW / 2) / c.zoom + c.x, (game.input.my - r.VH / 2) / c.zoom + c.y];
  }

  /** screen CSS position of a world point on the gameplay plane */
  css(x: number, y: number): [number, number] {
    const r = game.r;
    return game.ui.artToCss(r.projectX(x, 1), r.projectY(y, 1), r.VW, r.VH) as [number, number];
  }

  async runAction(it: Interactable) {
    if (this.busyAction) return;
    this.busyAction = true;
    try {
      if (it.standX !== undefined && Math.abs(this.player.x - it.standX) > 3) await this.player.walkTo(it.standX, 70);
      this.player.facing = it.x >= this.player.x ? 1 : -1;
      audio.play('ui', { vol: 0.4 });
      await it.action();
    } finally {
      this.busyAction = false;
    }
  }

  /** Scripted ladder / rope climb (for mouse and touch; keyboard players can also use W / S). */
  async climbLadder(ld: { x: number; y0: number; y1: number }, dir: 1 | -1) {
    const p = this.player;
    const c = this.st.terrain.climbs.find(k => Math.abs(k.x - ld.x) < 2);
    if (!c) return;
    p.x = c.x;
    p.y = dir > 0 ? c.y0 : c.y1;
    p.state = 'climb';
    p.climb = c;
    p.vx = p.vy = 0;
    p.autoClimb = dir;
    audio.play('stepWood' as never, { vol: 0.4 });
    await new Promise<void>(res => { const chk = () => (p.state !== 'climb' ? res() : requestAnimationFrame(chk)); chk(); });
  }

  /** Register a resource node as an interactable too. */
  addNode(n: ResourceNode, layer = this.main): ResourceNode {
    layer.add(n);
    this.nodes.push(n);
    this.interact.push({
      x: n.x, y: n.y, w: 12, h: 14, standX: n.x - 12,
      get label() { return n.label(); },
      enabled: () => n.available(this.night),
      action: () => this.collect(n),
    } as Interactable);
    return n;
  }

  /** The collecting flow: tool check, room check, animation + timer, rewards. */
  async collect(n: ResourceNode) {
    const def = n.def;
    if (!def) return;
    const miss = n.missingTools();
    if (miss.length) {
      audio.play('wrong', { vol: 0.5 });
      this.bark('rowan', `I need ${miss.map(m => `the ${ITEMS[m]?.name.toLowerCase() ?? m}`).join(' and ')} for this.`, { expr: 'thinking', emote: 'question' });
      return;
    }
    const gives: [string, number][] = n.contents ?? def.gives.map(([id, a, b]) => [id, a + Math.floor(rand.next() * (b - a + 1))] as [string, number]).filter(([, k]) => k > 0);
    if (!gives.every(([id, k]) => fits(id, k))) {
      audio.play('wrong', { vol: 0.5 });
      this.bark('rowan', 'My backpack is full. Time to sort it out.', { expr: 'worried', emote: 'sweat' });
      return;
    }
    this.player.facing = n.x >= this.player.x ? 1 : -1;
    const anim = def.anim === 'pick' ? 'kneel' : def.anim;
    let sfxT = 0, fxT = 0;
    const dur = def.time * perks.collectTime();
    const ok = await this.player.doWork(anim, dur, k => {
      n.progress = k;
      sfxT -= 1 / 60;
      fxT -= 1 / 60;
      if (sfxT <= 0) { sfxT = 0.45; audio.play(def.sfx as 'rustle', { vol: 0.35, pitch: 0.9 + rand.next() * 0.25 }); }
      if (fxT <= 0) { fxT = 0.18; this.collectFx(n, def.fx, 3); }
    });
    n.progress = -1;
    if (!ok) return;
    // bonus find
    if (perks.bonusItem() > 0 && gives.length && rand.next() < perks.bonusItem()) gives[0][1]++;
    const [cx, cy] = this.css(n.x, n.y - 16);
    let i = 0;
    for (const [id, k] of gives) {
      const got = add(id, k);
      if (got <= 0) continue;
      setTimeout(() => this.hud?.flyItem(id, got, ITEMS[id]?.name ?? id, cx + i * 22, cy - i * 6), i * 180);
      if (isSample(id) && !game.save.flags['sample:first']) game.save.flags['sample:first'] = true;
      i++;
    }
    if (!gives.length) this.bark('rowan', 'Empty. Worth a look though.', { expr: 'neutral' });
    this.collectFx(n, def.fx, 14);
    audio.play('collectPop' as 'ui', { vol: 0.6 });
    this.player.body.react('bounce');
    if (rand.next() < 0.3) this.player.body.showEmote('sparkle', 1);
    if (def.clue && addClue(def.clue)) {
      audio.play('discover');
      const c = CLUE_BY_ID[def.clue];
      game.ui.toast(`Field Guide clue: <b>${c?.name ?? def.clue}</b>`, 'CLUE', 'teal', 4200);
    }
    n.deplete();
    if (n.kind === 'snare') game.save.vars['snares'] = (game.save.vars['snares'] ?? 0) + 1;
    game.persist();
    this.hud?.refresh();
  }

  collectFx(n: ResourceNode, kind: string, count: number) {
    const lp = this.main.particles;
    const col: Record<string, [number, number, number]> = {
      leaf: [0.45, 0.75, 0.35], dirt: [0.45, 0.32, 0.2], spark: [1, 0.95, 0.6], glow: [0.5, 1, 0.9], water: [0.7, 0.85, 1], wood: [0.6, 0.45, 0.3], dust: [0.8, 0.75, 0.6],
    };
    const c = col[kind] ?? col.dust;
    for (let i = 0; i < count; i++) {
      const fr = kind === 'leaf' ? A.leaves[i % A.leaves.length] : kind === 'spark' || kind === 'glow' ? A.spark : A.dot2;
      lp.spawn({ frame: fr, x: n.x + rand.range(-8, 8), y: n.y - rand.range(2, 12), vx: rand.range(-40, 40), vy: rand.range(-90, -30), ay: kind === 'spark' || kind === 'glow' ? -20 : 240, life: rand.range(0.5, 1), color: c, alpha: 1, alpha1: 0, vrot: rand.range(-6, 6), flutter: kind === 'leaf' ? 1 : 0, floorY: n.y + 1 });
    }
  }

  async openPack() {
    if (!this.allowPack || game.ui.blocking || this.cutscene) return;
    await openBackpack({ onEat: (id: string) => this.eat(id) });
    this.hud?.refresh(true);
  }

  /** eat food from the backpack: sets the expedition buff */
  eat(id: string) {
    const d = ITEMS[id];
    if (!d?.eat) return;
    game.save.buff = d.eat;
    audio.play('munch' as 'ui', { vol: 0.6 });
    this.player.body.setExpr('happy', 1.5);
    this.player.body.showEmote('heart', 1.2);
    const what = d.eat === 'steady' ? 'Steady hands for the next trip.' : d.eat === 'quiet' ? 'Calm and quiet on your feet.' : 'Energy for extra shots.';
    game.ui.toast(`Ate <b>${d.name}</b>. ${what}`, 'FOOD', 'teal', 3200);
  }

  updateInteraction() {
    const inp = game.input;
    const camUp = !!(this as unknown as { cam?: { active?: boolean } }).cam?.active;
    if (inp.hitRaw('pause') && !game.ui.blocking && !this.cutscene && !camUp) { openPause(); return; }
    if (this.cutscene || game.ui.blocking || this.busyAction || this.player.state === 'work') {
      this.prompt.hide();
      for (const n of this.nodes) n.hover = false;
      // no quest markers hanging over cutscenes and minigames
      this.marks?.draw([]);
      return;
    }
    const [wx, wy] = this.worldMouse();
    this.hovered = null;
    for (const it of this.interact) {
      if (it.enabled && !it.enabled()) continue;
      if (Math.abs(wx - it.x) < it.w + 4 && wy > it.y - it.h * 2 - 8 && wy < it.y + 8) this.hovered = it;
    }
    game.r.canvas.style.cursor = this.hovered ? 'pointer' : '';
    this.updateMarks();
    const near = nearestInteractable(this.interact, this.player.x, this.player.y);
    this.nearIt = near;
    const show = this.hovered ?? near;
    for (const n of this.nodes) n.hover = !!show && Math.abs(show.x - n.x) < 1 && Math.abs(show.y - n.y) < 1;
    if (show) {
      const r = game.r;
      const sx = r.projectX(show.x, 1), sy = r.projectY(show.y - show.h * 2 - 8, 1);
      const [cx, cy] = game.ui.artToCss(sx, sy, r.VW, r.VH);
      const key = show === near ? '<span class="key">E</span> ' : '<span class="key">Click</span> ';
      this.prompt.show(key + show.label, cx, cy);
    } else this.prompt.hide();
    if (near && inp.hit('interact')) {
      this.runAction(near);
      return;
    }
    if (this.allowPack && (inp.keyHit('KeyI') || inp.keyHit('Tab'))) {
      this.openPack();
      return;
    }
    if (inp.click(0) && this.clickToWalk && this.player.state === 'normal') {
      if (this.hovered) this.runAction(this.hovered);
      else if (wy > 40) this.player.walkTo(Math.max(this.player.minX, Math.min(this.player.maxX, wx)), 64).catch(() => {});
    }
  }

  /** quest markers over the exact thing the current step needs (edge arrows when it's off screen) */
  private updateMarks() {
    if (!this.marks) this.marks = new QuestMarks(game.ui.prompts);
    const pts: [number, number][] = [];
    const hide = this.cutscene || game.ui.blocking;
    if (!hide) {
      for (const it of this.interact) if (it.quest && (!it.enabled || it.enabled()) && it.quest()) pts.push([it.x, it.y - it.h * 2 - 6]);
      for (const q of this.questPoints) if (q.on()) pts.push([q.x(), q.y()]);
    }
    const r = game.r;
    this.marks.draw(pts.map(([x, y]) => game.ui.artToCss(r.projectX(x, 1), r.projectY(y, 1), r.VW, r.VH) as [number, number]));
  }

  update(dt: number) {
    if (this.player.state === 'script' && game.input.axisX() !== 0 && !this.cutscene && !this.busyAction) {
      this.player.state = 'normal';
      this.player.scriptTarget = null;
    }
    this.player.control = !this.cutscene;
    this.updateInteraction();
    this.st.update(dt);
    if (!this.st.cam.locked && !this.player.camera) {
      this.st.cam.tx = this.player.x + this.player.facing * this.lookAhead * (Math.abs(this.player.vx) > 5 ? 1 : 0.5);
      this.st.cam.ty = this.camY;
    }
    updateQuests(dt);
    this.hud?.update(dt);
    audio.update(dt);
  }

  render(r: Renderer, dt: number) {
    this.st.updateCamera(dt, r);
    this.st.render(r, dt);
  }

  exit() {
    this.prompt?.hide();
    this.marks?.clear();
    this.hud?.destroy();
    this.hud = null;
    this.st?.clear();
    this.actors.clear();
  }
}

/** Pool of bouncing gold quest markers (HTML so they stay crisp), clamped to the screen edge as arrows. */
class QuestMarks {
  private els: HTMLElement[] = [];
  constructor(private root: HTMLElement) {
    if (!document.getElementById('qm-css')) {
      const st = document.createElement('style');
      st.id = 'qm-css';
      st.textContent = `
.qmark { position: absolute; width: 30px; height: 38px; margin: -38px 0 0 -15px; pointer-events: none; z-index: 3; transition: opacity 0.2s; }
.qmark i { position: absolute; inset: 0; background: var(--sk-qmark) center / 100% 100% no-repeat; image-rendering: pixelated; animation: qmBob 0.9s ease-in-out infinite; transform-origin: 50% 100%;
  filter: drop-shadow(0 3px 0 rgba(0,0,0,0.35)) drop-shadow(0 0 6px rgba(255,210,80,0.55)); }
.qmark.edge i { background-image: var(--sk-qarrow); animation: none; }
.qmark::after { content: ''; position: absolute; left: 50%; bottom: -8px; width: 16px; height: 5px; margin-left: -8px; border-radius: 50%; background: rgba(0,0,0,0.25); animation: qmShadow 0.9s ease-in-out infinite; }
.qmark.edge::after { display: none; }
@keyframes qmBob { 0%, 100% { transform: translateY(0) scale(1, 1); } 45% { transform: translateY(-7px) scale(0.94, 1.06); } 55% { transform: translateY(-7px); } 90% { transform: translateY(0) scale(1.08, 0.92); } }
@keyframes qmShadow { 45%, 55% { transform: scale(0.7); opacity: 0.6; } }`;
      document.head.appendChild(st);
    }
  }
  draw(pts: [number, number][]) {
    const R = this.root.getBoundingClientRect();
    const W = R.width, H = R.height, m = 28;
    while (this.els.length < pts.length) { const e = document.createElement('div'); e.className = 'qmark'; e.innerHTML = '<i></i>'; this.root.appendChild(e); this.els.push(e); }
    this.els.forEach((e, i) => {
      const p = pts[i];
      if (!p) { e.style.display = 'none'; return; }
      e.style.display = '';
      let [x, y] = p;
      const off = x < m || x > W - m || y < m + 30 || y > H - m;
      e.classList.toggle('edge', off);
      if (off) {
        // pinned to the screen edge, pointing toward the target
        const cx = W / 2, cy = H / 2, a = Math.atan2(y - cy, x - cx);
        x = Math.max(m, Math.min(W - m, x)); y = Math.max(m + 30, Math.min(H - m, y));
        (e.firstElementChild as HTMLElement).style.transform = `rotate(${a + Math.PI / 2}rad)`;
      } else (e.firstElementChild as HTMLElement).style.transform = '';
      e.style.left = x + 'px'; e.style.top = y + 'px';
    });
  }
  clear() { for (const e of this.els) e.remove(); this.els = []; }
}
