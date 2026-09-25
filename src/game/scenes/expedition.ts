// An expedition to one site at one time of day.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { StageScene } from './base';
import { game } from '../game';
import { Stage } from '../../world/stage';
import { Player } from '../../world/player';
import { Custom } from '../../world/props';
import { Creature, Ctx, Lure } from '../wildlife/creature';
import { CameraSystem, Shot } from '../camera';
import { SiteContent, SiteBuilder } from '../sites/types';
import { SiteId, CLUE_BY_ID } from '../species';
import { TimeOfDay, TIME_LABEL } from '../../world/timeofday';
import { SITE_NAMES } from '../story';
import { expeditionHud, ExpHudRefs, GADGETS } from '../../ui/hud';
import { openJournal } from '../../ui/journal';
import { openReview } from '../../ui/review';
import { props, propAnims, A } from '../assets';
import { addClue } from '../research';
import { sparkle, inShaft } from '../sites/kit';
import { audio } from '../../core/audio';
import { clamp, rand } from '../../core/math';
import { iconURL } from '../../ui/icons';
import { returnToCamp } from './travel';
import { buildFernwood } from '../sites/fernwood';
import { buildCanopy } from '../sites/canopy';
import { buildFalls } from '../sites/falls';
import { buildMangrove } from '../sites/mangrove';
import { buildCoast } from '../sites/coast';

const BUILDERS: Record<SiteId, SiteBuilder> = { fernwood: buildFernwood, canopy: buildCanopy, falls: buildFalls, mangrove: buildMangrove, coast: buildCoast };

export function createExpedition(site: SiteId, tod: TimeOfDay) {
  return new ExpeditionScene(site, tod);
}

export class ExpeditionScene extends StageScene {
  content!: SiteContent;
  ctx!: Ctx;
  cam!: CameraSystem;
  creatures: Creature[] = [];
  lures: Lure[] = [];
  hud!: ExpHudRefs;
  gadget = 0;
  clueTaken = new Set<string>();
  spawnTimers = new Map<string, number>();
  ending = false;
  lampOn = false;
  hurtLock = 0;

  constructor(readonly site: SiteId, readonly tod: TimeOfDay) {
    super();
    this.clickToWalk = false;
  }

  build() {
    const st = (this.st = new Stage(this.tod, { shade: 0 }));
    const main = () => st.layer('main');
    this.content = BUILDERS[this.site](st, this);
    const c = this.content;
    this.camY = c.camY;
    st.waterY = c.waterY;
    this.player = main().add(new Player(c.spawnX, st.terrain.groundY(c.spawnX), st.terrain));
    this.player.hides = c.hides;
    this.player.minX = st.minX + 12;
    this.player.maxX = st.maxX - 12;
    if (c.underwater) { this.player.underwater = true; this.player.y = (c.waterY ?? 40) + 30; }
    this.ctx = {
      st, terrain: st.terrain, player: this.player, creatures: this.creatures, lures: this.lures, tod: this.tod, main: main(), waterY: c.waterY,
      caught: (cr, sev) => this.caught(cr, sev),
      splash: (x, y, k = 1) => this.splash(x, y, k),
      spawn: cr => this.addCreature(cr),
      worldMinX: st.minX, worldMaxX: st.maxX,
    };
    (st as unknown as { ctx: Ctx }).ctx = this.ctx;
    // jeep (exit) at the site's entrance
    if (!c.underwater && !c.noJeep) {
      main().add(new Custom(3, (r) => {
        const x = c.jeepX, y = st.terrain.groundY(x);
        r.beginShadows();
        r.draw(A.shadow, x, y, 3.4, 1.2, 0, packColor(0, 0, 0, 0.5));
        r.endShadows();
        r.draw(props.jeep, x, y - 5, -1, 1);
        r.draw(propAnims.wheel[0], x + 56 - 24, y - 11, -1, 1);
        r.draw(propAnims.wheel[0], x + 56 - 88, y - 11, -1, 1);
      }));
    }
    this.interact.push({ x: c.jeepX, y: c.underwater ? (c.waterY ?? 40) + 20 : st.terrain.surfaceBelow(c.jeepX, -1000)?.y ?? st.terrain.groundY(c.jeepX), w: 44, h: c.underwater ? 40 : 18, label: c.exitLabel ?? 'Return to camp', action: () => this.finish() });
    // clues
    for (const cl of c.clues) {
      if (game.save.clues[cl.id]) continue;
      main().add(new Custom(20, (r, s) => { if (!this.clueTaken.has(cl.id)) sparkle(r, cl.x, cl.y, s.time); }));
      this.interact.push({ x: cl.x, y: cl.y, w: 10, h: 10, label: `Examine: ${CLUE_BY_ID[cl.id].name}`, enabled: () => !this.clueTaken.has(cl.id), action: () => this.takeClue(cl.id) });
    }
    // lures & traps drawing
    main().add(new Custom(12, (r, s) => {
      for (const l of this.lures) {
        if (l.life <= 0) continue;
        const f = l.kind === 'trap' ? propAnims.wheel[0] : null;
        if (f) continue;
        r.rect(l.x - 3, l.y - 3, 6, 3, packColor(0.45, 0.32, 0.18, 1));
        r.fxDraw(A.glow, l.x, l.y - 3, 0.25, 0.25, 0, packColor(1, 0.9, 0.6, 1), 0.3 + Math.sin(s.time * 3) * 0.1);
      }
    }, (dt) => {
      for (const l of this.lures) {
        l.life -= dt;
        if (l.life > 0 && rand.chance(dt * 2)) main().particles.spawn({ frame: A.soft, x: l.x, y: l.y - 4, vx: rand.range(-4, 4), vy: -10, life: 2, size: 0.12, size1: 0.4, color: [0.9, 0.8, 0.5], alpha: 0.35, alpha1: 0, wobble: 5 });
      }
      for (let i = this.lures.length - 1; i >= 0; i--) if (this.lures[i].life <= 0) this.lures.splice(i, 1);
    }));
    this.traps = [];
    main().add(new Custom(12.5, (r, s) => {
      for (const t of this.traps) {
        r.rect(t.x - 4, t.y - 9, 8, 6, packColor(0.3, 0.35, 0.2, 1));
        r.rect(t.x - 1, t.y - 3, 2, 3, packColor(0.25, 0.18, 0.1, 1));
        const on = Math.sin(s.time * 4) > 0;
        if (on) r.fxDraw(A.dot2, t.x + t.dir * 3, t.y - 8, 0.8, 0.8, 0, packColor(1, 0.2, 0.2, 1), 3);
      }
    }, (dt) => this.updateTraps(dt)));
    // spawn wildlife
    for (const rule of c.spawns) {
      if (rule.times && !rule.times.includes(this.tod)) continue;
      if (rule.when && !rule.when()) continue;
      for (let i = 0; i < rule.n; i++) this.addCreature(rule.make(this.ctx, i));
      if (rule.respawn) this.spawnTimers.set(rule.species, rule.respawn);
    }
    this.cam = new CameraSystem(this.site, this.tod);
    this.hud = expeditionHud(SITE_NAMES[this.site], TIME_LABEL[this.tod]);
    this.refreshHud();
    this.lampOn = this.tod === 'night' && !!game.save.upgrades.headlamp;
    audio.setAmbience(c.ambience, this.tod === 'night');
    audio.setMusic(this.tod === 'night' ? 'night' : c.music);
    if (c.followY) this.camY = this.player.y - 40;
    // headlamp + player-local light
    main().add(new Custom(60, (r) => {
      const p = this.player;
      if (this.lampOn) {
        const dir = p.facing;
        const hx = p.x + dir * 4, hy = p.headY + 6;
        const ang = this.cam.active ? Math.atan2(this.st.cam.y - hy, (this.st.cam.x - hx)) : 0.12 * dir;
        const flip = this.cam.active ? 1 : dir;
        r.lightTex(A.cone, hx, hy, 1.6 * flip, 1.1, this.cam.active ? ang : 0, packColor(1, 0.95, 0.82, 1), 2.4);
        r.light(p.x, p.y - 16, 44, 0.9, 0.9, 0.8, 0.5);
        r.fxDraw(A.glow, hx, hy, 0.18, 0.18, 0, packColor(1, 1, 0.9, 1), 2.5);
      }
    }));
    c.onEnter?.(this);
  }

  traps: { x: number; y: number; dir: number; cd: number; shots: number }[] = [];

  addCreature(c: Creature) {
    this.creatures.push(c);
    this.st.layer('main').add(c);
  }

  refreshHud() {
    const s = game.save;
    this.hud.film.innerHTML = `<img src="${iconURL('film')}" style="width:1.2em;image-rendering:pixelated" alt=""> <i>${this.cam.film}</i> shots`;
    GADGETS.forEach((g, i) => {
      const n = s.items[g.id] ?? 0;
      const slot = this.hud.gadgets[i];
      slot.classList.toggle('sel', i === this.gadget);
      slot.classList.toggle('empty', n <= 0);
      (slot.querySelector('.n') as HTMLElement).textContent = String(n);
    });
  }

  splash(x: number, y: number, k = 1) {
    const lp = this.st.layer('main').particles;
    for (let i = 0; i < 14 * k; i++) lp.spawn({ frame: A.dot2, x: x + rand.range(-6, 6) * k, y, vx: rand.range(-40, 40) * k, vy: rand.range(-90, -30) * k, ay: 260, life: 0.9, color: [0.8, 0.9, 1], alpha: 0.9, alpha1: 0.2, floorY: y + 2 });
    audio.play('splash', { vol: 0.4 * Math.min(1.5, k) });
  }

  caught(c: Creature, sev: number) {
    if (this.hurtLock > 0) return;
    this.hurtLock = 3;
    const p = this.player;
    p.hurtT = 1.6;
    this.st.shake(3 + sev * 2, 0.5);
    audio.play('alert');
    const lost = Math.min(this.cam.film, sev * 2);
    this.cam.film -= lost;
    p.vx = -Math.sign(c.x - p.x) * 140;
    p.vy = -90;
    p.onGround = false;
    game.r.post.flash = 0.4;
    game.ui.toast(sev >= 3 ? `The ${c.sp.name} nearly got you! You dropped ${lost} shots of film scrambling away.` : `Yikes! The ${c.sp.name} lunged at you. Lost ${lost} shots.`, 'DANGER', 'coral', 4200);
    this.refreshHud();
  }

  async takeClue(id: string) {
    this.clueTaken.add(id);
    addClue(id);
    audio.play('discover');
    const c = CLUE_BY_ID[id];
    game.ui.toast(`<b>${c.name}</b> — ${c.desc}`, 'CLUE', 'teal', 5200);
    game.persist();
    await this.content.onClue?.(this, id);
  }

  placeGadget() {
    const g = GADGETS[this.gadget];
    const s = game.save;
    if ((s.items[g.id] ?? 0) <= 0) { audio.play('wrong'); game.ui.toast(`No ${g.name}s left. Pip sells more.`, 'GEAR', 'coral'); return; }
    if (this.player.underwater) { audio.play('wrong'); return; }
    s.items[g.id]--;
    const x = this.player.x + this.player.facing * 12;
    const y = this.content.lurePlaceY ? this.content.lurePlaceY(x) : this.st.terrain.surfaceBelow(x, this.player.y - 6)?.y ?? this.player.y;
    if (g.id === 'trap') this.traps.push({ x, y, dir: this.player.facing, cd: 2, shots: 3 });
    else if (g.id === 'caller') {
      this.lures.push({ kind: 'fish', x, y, life: 45, eaten: 0, claimed: null });
      audio.play('birdCall', { vol: 0.6 });
      for (const c of this.creatures) if (c.sp.group === 'Bird' && !c.fleeing) c.lureTarget = null, c.aware = Math.max(0, c.aware - 0.3);
    } else this.lures.push({ kind: g.id, x, y, life: 70, eaten: 0, claimed: null });
    audio.play('place');
    game.ui.toast(`Placed: ${g.name}. Now hide and wait.`, 'GEAR', '', 2600);
    this.refreshHud();
  }

  updateTraps(dt: number) {
    for (const t of this.traps) {
      t.cd -= dt;
      if (t.cd > 0 || t.shots <= 0) continue;
      for (const c of this.creatures) {
        if (c.dead || c.hiddenFromCamera) continue;
        const dx = (c.x - t.x) * t.dir;
        if (dx > 5 && dx < 90 && Math.abs(c.y - t.y) < 40) {
          const shot = this.cam.trapShot(c);
          this.cam.shots.push(shot);
          t.cd = 8;
          t.shots--;
          audio.play('shutter', { vol: 0.25, pitch: 1.3 });
          game.ui.toast('Camera trap triggered!', 'TRAP', 'teal', 2200);
          break;
        }
      }
    }
  }

  async finish() {
    if (this.ending) return;
    this.ending = true;
    this.cam.active = false;
    this.cam.destroy();
    await openReview(this.cam.shots, this.site, this.tod);
    returnToCamp(this.site, this.tod);
  }

  update(dt: number) {
    this.hurtLock -= dt;
    const inp = game.input;
    if (!game.ui.blocking && !this.cutscene) {
      for (let i = 0; i < 5; i++) if (inp.hit(('g' + (i + 1)) as 'g1')) { this.gadget = i; audio.play('ui', { vol: 0.4 }); this.refreshHud(); }
      if (inp.hit('place') && !this.cam.active) this.placeGadget();
      if (inp.hit('journal')) openJournal();
    }
    if (!this.cutscene) this.cam.update(dt, this.st, this.player, this.creatures);
    // cleanup dead creatures
    for (let i = this.creatures.length - 1; i >= 0; i--) if (this.creatures[i].dead) this.creatures.splice(i, 1);
    // respawn populations
    for (const rule of this.content.spawns) {
      const t = this.spawnTimers.get(rule.species);
      if (t === undefined) continue;
      const have = this.creatures.filter(c => c.id === rule.species).length;
      if (have < rule.n) {
        const nt = t - dt;
        if (nt <= 0) {
          this.addCreature(rule.make(this.ctx, have));
          this.spawnTimers.set(rule.species, rule.respawn!);
        } else this.spawnTimers.set(rule.species, nt);
      }
    }
    // light-shaft flags for photos & basking
    const shafts = this.content.shafts ?? [];
    for (const c of this.creatures) c.inLight = shafts.length ? inShaft(shafts, c.x, c.y) : (this.tod === 'dusk' || this.tod === 'dawn');
    // awareness meter
    let maxA = 0, who: Creature | null = null;
    for (const c of this.creatures) if (Math.abs(c.x - this.player.x) < 260 && c.aware > maxA) { maxA = c.aware; who = c; }
    this.hud.aware.style.opacity = maxA > 0.05 ? '1' : '0';
    this.hud.awareBar.style.width = maxA * 100 + '%';
    this.hud.awareBar.style.background = maxA > 0.85 ? 'var(--coral)' : maxA > 0.5 ? 'var(--amber)' : 'var(--teal)';
    this.hud.awareLabel.textContent = maxA > 0.95 ? (who && who.sp.danger >= 2 ? 'DANGER!' : 'Spotted!') : maxA > 0.5 ? 'Suspicious' : 'Noticed';
    audio.setDanger(this.creatures.some(c => c.sp.danger >= 2 && Math.abs(c.x - this.player.x) < 260 && c.aware > 0.4) ? 0.8 : 0);
    this.content.onUpdate?.(this, dt);
    super.update(dt);
    if (this.cam.active) {
      this.st.cam.tx = this.cam.aimX;
      this.st.cam.ty = this.cam.aimY;
    } else if (this.content.followY) {
      this.camY = clamp(this.player.y - 40, this.st.minY + 135, this.st.maxY - 135);
      this.st.cam.ty = this.camY;
    }
    if (this.hud.film.dataset.f !== String(this.cam.film)) {
      this.hud.film.dataset.f = String(this.cam.film);
      this.refreshHud();
    }
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
  }

  exit() {
    super.exit();
    this.cam?.destroy();
    for (const c of this.creatures) (c as unknown as { spr?: { dispose(): void } }).spr?.dispose();
    audio.setDanger(0);
  }
}

export type { Shot };
