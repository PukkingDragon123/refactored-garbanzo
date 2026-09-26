// FieldScene: an expedition site in V2. Hosts the living ecosystem (wild/*), the field camera,
// lures, resource nodes, the insect layer and Aroha as a guide who follows, hides and whispers.

import type { Renderer } from '../../gfx/renderer';
import { packColor } from '../../gfx/renderer';
import { game } from '../game';
import { Stage, Layer } from '../../world/stage';
import { Player, HideSpot } from '../../world/player';
import type { TimeOfDay } from '../../world/timeofday';
import type { Ambience, Music } from '../../core/audio';
import { audio } from '../../core/audio';
import type { SiteId } from '../species';
import { SPECIES_BY_ID } from '../species';
import { WorldScene } from './world';
import { Animal, Herd } from '../wild/animal';
import '../wild/specials';
import type { Medium } from '../wild/ecology';
import type { Lure, POI, Sound, WildHost } from '../wild/world';
import { makeBody, warmBeast } from '../wild/bodies';
import { Insects, InsectKind } from '../wild/insects';
import { FieldCamera, Occluder } from '../fieldcam';
import { arohaSpots } from '../script';
import { Actor } from '../../world/actor';
import { count, remove } from '../inventory';
import { ITEMS } from '../items';
import { rawPhotos } from '../photos';
import { A } from '../assets';
import { clamp, rand } from '../../core/math';
import type { Frame } from '../../gfx/renderer';

export interface SpawnV2 {
  species: string;
  times?: TimeOfDay[];
  /** 0..1 chance this spawn happens on a visit */
  chance?: number;
  n: [number, number];
  x: [number, number];
  y?: number;
  medium?: Medium;
  herd?: boolean;
  /** fraction of juveniles in a herd */
  juveniles?: number;
  /** spawn at a POI of this kind (trunks, perches, burrows, nests...) */
  poi?: POI['kind'];
  when?: () => boolean;
  /** can wander in later during the visit */
  later?: boolean;
}

export interface FieldSite {
  id: SiteId | 'camp' | 'boat';
  /** no Aroha-follows-you guide (camp) */
  noGuide?: boolean;
  /** no "head back to camp" exit (camp itself) */
  noExit?: boolean;
  name: string;
  width: number;
  camY: number;
  followY?: boolean;
  minY?: number;
  maxY?: number;
  spawnX: number;
  exitX: number;
  waterY: number | null;
  underwater?: boolean;
  ambience: Ambience;
  music: Music;
  ground?: Player['ground'];
  build(f: FieldScene): void | Promise<void>;
  spawns: SpawnV2[];
  insects?: { kind: InsectKind; x: [number, number]; y: [number, number]; n: number; times?: TimeOfDay[] }[];
  onEnter?(f: FieldScene): void | Promise<void>;
  onUpdate?(f: FieldScene, dt: number): void;
}

const LURE_FOOD: Record<string, { food: Lure['food']; scent: number; glow?: boolean; call?: boolean }> = {
  fruitlure: { food: ['fruit', 'nectar', 'seeds'], scent: 320 },
  grublure: { food: ['grub', 'insect'], scent: 300 },
  fishbait: { food: ['fish'], scent: 340 },
  scentlure: { food: ['carrion'], scent: 480 },
  glowlure: { food: ['insect'], scent: 300, glow: true },
  caller: { food: [], scent: 420, call: true },
};

/** Aroha as field guide: follows at a respectful distance, mirrors your stealth, whispers tips. */
class Guide {
  spotted = new Set<string>();
  private tipT = 4;
  constructor(readonly a: Actor, readonly f: FieldScene) {}
  update(dt: number) {
    const p = this.f.player, a = this.a;
    const want = p.x - p.facing * 46;
    const d = want - a.x;
    const sneaking = p.crouch || p.state === 'hide' || p.camera;
    a.idleAnim = sneaking ? 'crouch' : 'staff';
    if (Math.abs(d) > 70 || (Math.abs(d) > 24 && Math.abs(p.vx) < 5)) {
      const run = Math.abs(d) > 150;
      a.walkAnim = sneaking ? 'crouchWalk' : run ? 'run' : 'staffWalk';
      if (!a.walking || Math.abs(d) > 30) a.walkTo(want, sneaking ? 28 : run ? 120 : 62, a.walkAnim);
    }
    if (!a.walking && a.anim !== a.idleAnim && a.anim !== 'track' && a.anim !== 'explain') a.setAnim(a.idleAnim);
    if (!a.walking) a.faceTo(p.x + p.facing * 60);
    a.y = this.f.st.terrain.surfaceBelow(a.x, a.y - 12, 0)?.y ?? a.y;
    // spotting tips
    this.tipT -= dt;
    if (this.tipT > 0 || game.ui.bubbles.active) return;
    for (const an of this.f.animals) {
      if (an.dead || an.gone || this.spotted.has(an.species) || an.hidden > 0.7) continue;
      const dist = Math.abs(an.x - p.x);
      const r = game.r;
      const sx = r.projectX(an.x, an.p);
      if (dist < 240 && sx > 20 && sx < r.VW - 20) {
        this.spotted.add(an.species);
        const tip = arohaSpots(an.species);
        if (tip) {
          game.ui.bubbles.bark('aroha', tip, { style: 'whisper', expr: an.eco.aggro > 0.6 ? 'serious' : 'happy', emote: an.eco.aggro > 0.6 ? 'exclaim' : undefined } as never);
          this.a.faceTo(an.x);
          if (an.eco.aggro < 0.5) this.a.play('explain', this.a.idleAnim).catch(() => {});
        }
        this.tipT = 7;
        break;
      }
    }
  }
}

export class FieldScene extends WorldScene implements WildHost {
  site: FieldSite;
  tod: TimeOfDay;
  animals: Animal[] = [];
  lures: Lure[] = [];
  pois: POI[] = [];
  sounds: Sound[] = [];
  occluders: Occluder[] = [];
  minX = 0;
  maxX = 1000;
  waterY: number | null = null;
  time = 0;
  cam!: FieldCamera;
  insects = new Insects();
  guide: Guide | null = null;
  lampOn = false;
  private lureSel = 0;
  private hurtLock = 0;
  private respawnT = 30;
  private lureFrames: Record<string, Frame> = {};
  /** extra light sources (lanterns, glowing fungi) for exposure */
  lights: { x: number; y: number; r: number; k: number }[] = [];
  /** sunlit patches on the gameplay plane (for basking + exposure) */
  sunspots: { x: number; w: number }[] = [];

  get terrain() {
    return this.st.terrain;
  }

  constructor(site: FieldSite, tod: TimeOfDay) {
    super();
    this.site = site;
    this.tod = tod;
    this.night = tod === 'night';
  }

  hudOpts() {
    const t = { dawn: 'Dawn', day: 'Midday', dusk: 'Golden hour', night: 'Night' }[this.tod];
    return {
      place: this.site.name, sub: `Day ${game.save.day} · ${t}`,
      keys: '<span class="key">Q</span> camera · <span class="key">F</span> lure · <span class="key">1-5</span> pick lure · <span class="key">Shift</span> hold breath · <span class="key">E</span> interact · <span class="key">I</span> pack',
    };
  }

  async build() {
    const s = this.site;
    this.st = new Stage(this.tod);
    this.minX = 0;
    this.maxX = s.width;
    this.st.minX = 0;
    this.st.maxX = s.width;
    if (s.minY !== undefined) this.st.minY = s.minY;
    if (s.maxY !== undefined) this.st.maxY = s.maxY;
    this.waterY = s.waterY;
    this.st.waterY = s.waterY;
    this.camY = s.camY;
    await s.build(this);
    this.main = this.st.layer('main');
    this.player = new Player(s.spawnX, this.st.terrain.groundY(s.spawnX), this.st.terrain);
    this.player.minX = 12;
    this.player.maxX = s.width - 12;
    this.player.underwater = !!s.underwater;
    this.player.ground = s.ground ?? 'leaves';
    this.main.add(this.player);
    // guide
    if (game.save.flags['aroha:met'] && !s.underwater && !s.noGuide) {
      const a = this.addActor('aroha', s.spawnX - 50, this.st.terrain.groundY(s.spawnX - 50), 1);
      a.idleAnim = 'staff';
      a.setAnim('staff');
      a.z = 45;
      this.guide = new Guide(a, this);
    }
    // insects
    this.insects.night = this.night;
    this.insects.waterY = s.waterY;
    this.insects.player = this.player;
    for (const b of s.insects ?? []) {
      if (b.times && !b.times.includes(this.tod)) continue;
      for (let i = 0; i < b.n; i++) this.insects.spawn(b.kind, rand.range(b.x[0], b.x[1]), rand.range(b.y[0], b.y[1]), 1, 10);
    }
    this.insects.flowers = this.pois.filter(p => p.kind === 'flower').map(p => [p.x, p.y] as [number, number]);
    this.main.add(this.insects);
    // wildlife
    for (const sp of s.spawns) this.spawnRule(sp, false);
    for (const id of new Set(this.animals.map(a => a.species))) warmBeast(id);
    // camera
    this.cam = new FieldCamera(this, s.id === 'boat' ? 'sea' : s.id);
    this.cam.occluders = this.occluders;
    this.cam.onShot = () => this.hud?.refresh();
    this.lampOn = this.night && game.save.tools.includes('headlamp');
    // exit back to camp
    if (!s.noExit) this.interact.push({ x: s.exitX, y: this.st.terrain.groundY(s.exitX), w: 20, h: 26, label: 'Head back to camp', standX: s.exitX, action: () => this.leave() });
    game.save.flags['visit:' + s.id] = true;
    game.persist();
    audio.setAmbience(s.ambience, this.night);
    audio.setMusic(s.music);
  }

  async enter() {
    await super.enter();
    await this.site.onEnter?.(this);
  }

  // ---------------------------------------------------------------- spawning
  spawnRule(sp: SpawnV2, later: boolean) {
    if (sp.times && !sp.times.includes(this.tod)) return;
    if (sp.when && !sp.when()) return;
    if (!later && sp.chance !== undefined && rand.next() > sp.chance) return;
    const n = Math.round(rand.range(sp.n[0], sp.n[1]));
    if (n <= 0) return;
    const herd = sp.herd ? new Herd(sp.species) : null;
    const pois = sp.poi ? this.pois.filter(p => p.kind === sp.poi && p.x >= sp.x[0] - 40 && p.x <= sp.x[1] + 40) : [];
    for (let i = 0; i < n; i++) {
      let x = later ? (rand.next() < 0.5 ? -40 : this.maxX + 40) : rand.range(sp.x[0], sp.x[1]);
      let y = sp.y ?? this.st.terrain.groundY(x);
      const juv = !!herd && i > 0 && rand.next() < (sp.juveniles ?? 0);
      let poi: POI | null = null;
      if (pois.length && !later) {
        poi = pois[i % pois.length];
        x = poi.x;
        y = poi.kind === 'trunk' ? rand.range(poi.y1 ?? poi.y - 100, poi.y - 30) : poi.y;
      }
      const a = new Animal(sp.species, x, y, { juvenile: juv, medium: sp.medium, home: [sp.x[0], sp.x[1]] });
      a.host = this;
      if (poi && (poi.kind === 'trunk' || poi.kind === 'branch' || poi.kind === 'perch' || poi.kind === 'nest')) a.poi = poi;
      if (a.medium === 'ground') a.settle();
      if (a.medium === 'water' && this.waterY !== null) a.y = Math.max(a.y, this.waterY + 4);
      if (a.medium === 'air') a.y = Math.min(a.y, this.st.terrain.groundY(x) - rand.range(80, 170));
      a.body = makeBody(a);
      herd?.add(a);
      this.animals.push(a);
      this.main.add(a);
      if (later) a.setAct('wander', 8);
    }
  }

  // ---------------------------------------------------------------- WildHost
  caught(a: Animal, sev: number) {
    if (this.hurtLock > 0) return;
    this.hurtLock = 3;
    const p = this.player;
    p.hurtT = 1.6;
    this.st.shake(3 + sev * 2, 0.5);
    audio.play('alert');
    game.r.post.flash = 0.35;
    p.cancelWork();
    const lost = Math.min(this.cam.shots, sev * 2);
    this.cam.shots -= lost;
    p.vx = -Math.sign(a.x - p.x || 1) * 150;
    p.vy = -100;
    p.onGround = false;
    p.body.react('jump');
    p.body.setExpr('scared', 2);
    p.body.showEmote('star', 1.6);
    if (this.guide) game.ui.bubbles.bark('aroha', sev >= 3 ? 'RUN, Doc! Now!' : 'I told you to back away!', { style: 'shout', expr: 'angry', emote: 'alarm' } as never);
    game.ui.toast(`The ${SPECIES_BY_ID[a.species]?.name ?? a.species} ${sev >= 3 ? 'nearly got you!' : 'lunged at you!'} You fumbled the camera and lost ${lost} shot${lost === 1 ? '' : 's'}.`, 'DANGER', 'coral', 4200);
  }

  splash(x: number, y: number, k = 1) {
    const lp = this.main.particles;
    for (let i = 0; i < 14 * k; i++) lp.spawn({ frame: A.dot2, x: x + rand.range(-6, 6) * k, y, vx: rand.range(-40, 40) * k, vy: rand.range(-90, -30) * k, ay: 260, life: 0.9, color: [0.8, 0.9, 1], alpha: 0.9, alpha1: 0.2, floorY: y + 2 });
    this.sfx(k > 1 ? 'splashBig' : 'splash', x, 0.4 * Math.min(1.5, k));
    this.sounds.push({ x, y, kind: 'splash', src: null, species: null, radius: 200 * k, t: this.time + 0.0001 });
  }

  lightAt(x: number, y: number) {
    const base = this.tod === 'night' ? 0.1 : this.tod === 'dusk' || this.tod === 'dawn' ? 0.6 : 0.85;
    let l = base;
    for (const s of this.sunspots) if (Math.abs(x - s.x) < s.w * 0.5) l += 0.25;
    for (const L of this.lights) { const d = Math.hypot(L.x - x, L.y - y); if (d < L.r) l += (1 - d / L.r) * L.k; }
    if (this.lampOn) {
      const p = this.player;
      const dx = (x - p.x) * p.facing;
      if (dx > -10 && dx < 180 && Math.abs(y - p.eyeY) < 50 + dx * 0.3) l += 0.65 * (1 - dx / 200);
    }
    return clamp(l);
  }

  catchInsect(x: number, y: number, r: number) {
    return this.insects.catch(x, y, r);
  }

  sfx(name: string, x: number, vol = 0.5, pitch = 1) {
    const cx = this.st.cam.x;
    const d = x - cx;
    const k = clamp(1 - Math.abs(d) / 520);
    if (k <= 0.02) return;
    audio.play(name as 'ui', { vol: vol * k, pitch, pan: clamp(d / 320, -1, 1) });
  }

  // ---------------------------------------------------------------- lures
  lureItems(): string[] {
    return Object.keys(LURE_FOOD).concat('trap').filter(id => count(id) > 0);
  }

  placeLure() {
    const items = this.lureItems();
    if (!items.length) { audio.play('wrong'); game.ui.toast('No lures in your backpack. Craft some at the workbench.', 'LURE', 'coral'); return; }
    const id = items[this.lureSel % items.length];
    if (this.player.underwater) { audio.play('wrong'); return; }
    remove(id, 1);
    const x = this.player.x + this.player.facing * 14;
    const y = this.st.terrain.surfaceBelow(x, this.player.y - 8)?.y ?? this.player.y;
    const f = LURE_FOOD[id] ?? { food: [], scent: 0 };
    const l: Lure = { kind: id, x, y, life: id === 'trap' ? 999 : 70, eaten: 0, claimed: null, food: f.food, scent: f.scent, glow: f.glow, call: f.call };
    this.lures.push(l);
    this.player.body.play('kneel', 'idle').catch(() => {});
    audio.play('place' as 'ui', { vol: 0.5 });
    if (f.call) this.sfx('callChirp', x, 0.6, 1.2);
    this.sounds.push({ x, y, kind: 'noise', src: null, species: null, radius: 60, t: this.time + 0.0001 });
    game.ui.toast(`Placed <b>${ITEMS[id].name}</b>. ${count(id)} left. Now hide and wait.`, 'LURE', 'teal', 2600);
    if (!this.lureFrames[id]) {
      // tiny procedural lure sprite: reuse the glow dot as a marker until art lands
      this.lureFrames[id] = A.blob;
    }
    if (f.glow) this.insects.lights.push({ x, y: y - 4, k: 1.5 });
    this.hud?.refresh();
  }

  async leave() {
    if (this.cutscene) return;
    this.cutscene = true;
    this.cam.raise(false);
    const n = rawPhotos().length;
    if (this.guide) await this.say([{ who: 'aroha', text: n ? `Home, then. You’ve got ${n} photo${n > 1 ? 's' : ''} to go through on that laptop.` : 'Home, then. Next time, take some photos.', expr: 'happy' }]);
    const { goCamp } = await import('./flow');
    goCamp(true);
  }

  // ---------------------------------------------------------------- frame
  update(dt: number) {
    this.time += dt;
    this.hurtLock -= dt;
    const inp = game.input;
    const p = this.player;
    // camera raise: Q toggles, right mouse held
    if (!this.cutscene && !game.ui.blocking) {
      if (inp.hit('camera')) this.cam.raise(!this.cam.active);
      if (inp.mousePressed[2]) this.cam.raise(true);
      if (inp.mouseReleased[2] && this.cam.active) this.cam.raise(false);
      if (inp.hit('place')) this.placeLure();
      for (let i = 0; i < 5; i++) if (inp.keyHit('Digit' + (i + 1))) { this.lureSel = i; const it = this.lureItems()[i]; if (it) game.ui.toast(`Lure: <b>${ITEMS[it].name}</b> (${count(it)})`, 'LURE', '', 1400); }
    }
    p.camera = this.cam.active;
    if (!this.cam.active) this.cam.settle(this.st);
    this.cam.breathless = Math.max(this.cam.breathless, p.sinceRun < 1.5 ? 1 - p.sinceRun / 1.5 : 0);
    this.cam.lamp = this.lampOn ? 0.45 : 0;
    this.clickToWalk = !this.cam.active;
    super.update(dt);
    this.cam.update(dt, this.st, p.x, p.eyeY, p.crouch || p.state === 'hide', this.animals);
    if (!this.cam.active && this.site.followY) this.st.cam.ty = p.y - 60;
    this.guide?.update(dt);
    this.insects.update(dt);
    // lures age
    for (const l of this.lures) l.life -= dt;
    this.lures = this.lures.filter(l => l.life > 0 || l.kind === 'trap');
    // forget old sounds
    if (this.sounds.length) this.sounds = this.sounds.filter(s => s.t > this.time - 2.5);
    // tidy up animals that left; occasionally new ones wander in
    this.animals = this.animals.filter(a => !a.dead && !a.gone);
    this.respawnT -= dt;
    if (this.respawnT <= 0) {
      this.respawnT = rand.range(35, 60);
      const later = this.site.spawns.filter(s => s.later && (!s.times || s.times.includes(this.tod)));
      if (later.length && this.animals.length < 28) {
        const sp = later[Math.floor(rand.next() * later.length)];
        if (rand.next() < (sp.chance ?? 0.6)) this.spawnRule({ ...sp, n: [1, Math.max(1, Math.min(2, sp.n[1]))] }, true);
      }
    }
    // danger music
    let danger = 0;
    for (const a of this.animals) {
      if ((a.eco.attacksPlayer ?? 0) <= 0) continue;
      const d = Math.abs(a.x - p.x);
      if (d < 260 && (a.anger > 0.3 || a.act === 'attack' || a.act === 'threat')) danger = Math.max(danger, 1 - d / 260);
    }
    audio.setDanger(danger);
    this.site.onUpdate?.(this, dt);
  }

  render(r: Renderer, dt: number) {
    super.render(r, dt);
    // headlamp cone
    if (this.lampOn) {
      const p = this.player;
      r.layer(1);
      r.lightTex(A.cone, p.x + p.facing * 4, p.eyeY, p.facing * 2.2, 1.3, 0, packColor(1, 0.95, 0.8, 1), 2.2);
      r.light(p.x, p.eyeY, 40, 1, 0.95, 0.8, 0.5);
    }
    // lures
    r.layer(1);
    for (const l of this.lures) {
      const f = this.lureFrames[l.kind] ?? A.blob;
      r.draw(f, l.x, l.y - 3, 0.6, 0.5, 0, l.glow ? packColor(0.6, 1, 0.9, 1) : packColor(0.9, 0.75, 0.5, 1));
      if (l.glow && this.night) { r.fxDraw(A.glow, l.x, l.y - 4, 0.4, 0.4, 0, packColor(0.5, 1, 0.9, 1), 2); r.light(l.x, l.y - 4, 60, 0.4, 1, 0.9, 1.2); }
    }
  }

  exit() {
    this.cam?.destroy();
    audio.setDanger(0);
    super.exit();
  }
}

export type { Layer, HideSpot };
