// V12 the wild's encounters in Te Tuawhenua (user: "in the wild more props and wildlife that's actually
// cool and unique you can interact with"). Each one is a thing to do, not just a thing to see, and they
// feed each other: grubs from the logs bait the eel and steam over the vents.
//
//   the rotten logs    roll one over (a heave) and the wet bed under it is alive: huhu grubs to take
//                      and eat (better steamed), and under the big one in the feathered gully a giant
//                      velvet worm that squirts glue at whoever disturbed it
//   the old rimu       knock on its trunk and a ruru wakes in the hollow: yellow eyes, the head turned
//                      right round, "more-pork"; at dusk it goes out hunting
//   the deep pool      in the creek bed: drop a huhu grub in and a longfin eel as long as Mori rises
//                      out of the undercut bank to take it
//   the overhang       sit still in its dark recess until your eyes adjust and the ceiling comes on:
//                      titiwai, glow-worms, their beaded lines hanging under them (at night, always)
//   the hot pools      at the gorge's end: mud pots blurping, steam; soak your feet (stamina back),
//                      steam huhu over the vent
//   the kea            on the burnt ridge: clowns that come to look at you, and if you stand about
//                      they go through your pack and make off with something
//
// Art: src/art/v12/wild/encounters.ts (the props); the animals: ./birds.ts (kea, ruru) and
// ./crawlers.ts (tuna, ngaokeoke); the glow-worms' guide entry: ./species.ts.

import type { FieldScene } from '../../scenes/field';
import type { Interactable } from '../../../world/npc';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { Prop, Custom } from '../../../world/props';
import { sprite } from '../../sites2/common';
import { tuaHooks } from '../backcountry/hooks';
import { tuaGround } from '../backcountry/gen';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { floatText, floatNotice } from '../../../ui/v12/float';
import { give, has, remove, count, stacks } from '../../inventory';
import { ITEMS } from '../../items';
import { refillStamina } from '../stamina';
import { dayNumber } from '../../v10/day';
import { dropOnGround } from '../../v11/ground';
import type { Animal } from '../../wild/animal';
import { rottenLog, logBed, huhuGrub, hollowTree, hollowLip, HOLLOW, overhang, OVERHANG, eelPool, POOL, geoField, GEO, litter } from '../../../art/v12/wild/encounters';
import { KEA_CTX, RURU_CTX, spawnKea, spawnRuru, ruruKnock, ruruInHollow } from './birds';
import { TUNA_CTX, spawnTuna, tunaFeed, WORM_CTX, spawnWorm, wormReveal } from './crawlers';
import { TITIWAI_ID } from './species';
import './items';

/** where everything is (backcountry world x), clear of the feud's arena and its signs */
export const WILD = {
  logs: [{ x: 1550, worm: false, seed: 41 }, { x: 9450, worm: true, seed: 47 }],
  ruru: 7380,
  pool: 8888,
  overhang: 9060,
  geo: 13560,
  kea: [5760, 6010],
};

const F = (k: string) => !!game.save.flags[k];
const setF = (k: string) => { if (!game.save.flags[k]) { game.save.flags[k] = true; game.persist(); } };
const say = (text: string, style: 'say' | 'think' | 'happy' | 'shout' | 'scared' | 'whisper' | 'laugh' = 'say', ms = 2800) => void floatText({ text, style, ms });
const aroha = (f: FieldScene, text: string, style = 'say') => { if (f.guide) game.ui.bubbles.bark('aroha', text, { style } as never); };
const gy = (x: number) => tuaGround(x);

/** what the scene keeps per visit */
interface Wild {
  busy: boolean;
  worm: Animal | null;
  ruru: Animal | null;
  tuna: Animal | null;
  ripples: { x: number; y: number; t: number; big: boolean }[];
  /** 0..1: Mori sitting in the overhang's dark (his eyes adjusting) */
  sitDark: number;
  sitting: boolean;
  hinted: Set<string>;
}
const state = new WeakMap<FieldScene, Wild>();
const W = (f: FieldScene): Wild => {
  let w = state.get(f);
  if (!w) { w = { busy: false, worm: null, ruru: null, tuna: null, ripples: [], sitDark: 0, sitting: false, hinted: new Set() }; state.set(f, w); }
  return w;
};

function fly(f: FieldScene, id: string, n: number, x: number, y: number) {
  const [cx, cy] = f.css(x, y);
  f.hud?.flyItem(id, n, ITEMS[id]?.name ?? id, cx, cy);
  audio.play('collectPop' as never, { vol: 0.6 });
  f.hud?.refresh();
}

// ================================================================== the rotten logs

function buildLog(f: FieldScene, L: { x: number; worm: boolean; seed: number }) {
  const x = L.x, y = gy(x) + 2;
  const len = L.worm ? 92 : 76;
  const sLog = sprite(`wild:log:${L.seed}`, () => rottenLog(L.seed, len, L.worm ? 20 : 17));
  const sRolled = sprite(`wild:logR:${L.seed}`, () => rottenLog(L.seed, len, L.worm ? 20 : 17, true));
  const sBed = sprite(`wild:bed:${L.seed}`, () => logBed(L.seed, len + 6));
  if (!sLog || !sRolled || !sBed) return;
  const bed = new Prop(sBed.f, x, y, -2.25, { foliage: false });
  const log = new Prop(sLog.f, x, y, -2.2, { foliage: false });
  const rolledLog = new Prop(sRolled.f, x - 2, y - 7, -2.6, { foliage: false });
  bed.hidden = true; rolledLog.hidden = true;
  f.main.add(rolledLog); f.main.add(bed); f.main.add(log);
  // under the big log: drifts of leaf litter close by, where whatever lived under it can creep off to
  if (L.worm) for (const dx of [-74, 72]) {
    const lx = x + dx, s = sprite(`wild:litter:${dx}`, () => litter(L.seed + dx));
    if (!s) continue;
    f.main.add(new Prop(s.f, lx, gy(lx) + 2, 31, { foliage: false }));
    f.pois.push({ kind: 'cover', x: lx, y: gy(lx), w: 12 } as never);
  }
  // the grubs (none if they were taken today)
  const key = `wild:huhu:${x}`;
  const grubs: Prop[] = [];
  const left = () => (game.save.vars[key] ?? 0) !== dayNumber();
  for (let i = 0; i < 3; i++) {
    const g = sprite(`wild:grub:${i % 2}`, () => huhuGrub(i));
    if (!g) continue;
    const p = new Prop(g.f, x - 18 + i * 17 + (i === 1 ? 3 : 0), y - 3 - (i % 2), -2.24, { foliage: false });
    p.hidden = true;
    grubs.push(p);
    f.main.add(p);
  }
  let rolled = false;
  // the roll: the log tips back over its far side, settling a little further back, the bed showing
  const roll = () => {
    rolled = true;
    let t = 0;
    log.hidden = true;
    const anim = new Custom(-2.21, r => {
      if (t >= 1) return;
      const k = t * t * (3 - 2 * t);
      r.draw(sLog.f, x - 2 * k, y - 7 * k - Math.sin(k * Math.PI) * 5, 1, 1 - k * 0.12, -k * 0.35);
    }, dt => {
      if (t >= 1) return;
      t = Math.min(1, t + dt / 0.6);
      if (t >= 1) { rolledLog.hidden = false; audio.play('land' as never, { vol: 0.5, pitch: 0.7 }); }
    });
    f.main.add(anim);
    bed.hidden = false;
    if (left()) for (const g of grubs) g.hidden = false;
  };
  (f.interact as Interactable[]).push({
    x, y: y - 14, w: Math.round(len / 2) - 8, h: 18, standX: x - Math.round(len / 2) + 6,
    get label() { return !rolled ? 'Roll the rotten log over' : 'Take the huhu grubs'; },
    enabled: () => !W(f).busy && (!rolled || (left() && grubs.some(g => !g.hidden))),
    action: async () => {
      const w = W(f);
      if (w.busy) return;
      w.busy = true;
      try {
        if (!rolled) {
          if (!F('wild:logTip')) { setF('wild:logTip'); say('It\'s gone soft as cake. Something\'s been tunnelling all through it...', 'think', 2600); }
          const Q = await import('../qte');
          const res = await Q.qte({ kind: 'mash', label: 'HEAVE!', difficulty: 0.42, count: 9, time: 4.5, f, x, y: y - 40, pose: 'pull' });
          if (!res.ok) { say('Ngh... heavier than it looks. One more go.', 'say', 2000); return; }
          roll();
          if (L.worm && w.worm) {
            wormReveal(w.worm);
            if (!F('wild:wormSeen')) {
              setF('wild:wormSeen');
              audio.play('discover' as never, { vol: 0.6 });
              setTimeout(() => say('Whoa. WHOA. What IS that? It\'s velvet... and it has legs. So many legs.', 'scared', 3000), 500);
              setTimeout(() => aroha(f, 'Ngaokeoke! Koro says they\'re older than the dinosaurs. Careful, they spit!', 'shout'), 2200);
            }
          } else if (left()) setTimeout(() => say('Huhu grubs! Big fat ones.', 'happy', 2200), 500);
          else setTimeout(() => say('Already had the grubs from this one today.', 'think', 2000), 500);
          return;
        }
        // the grubs
        const n = grubs.filter(g => !g.hidden).length;
        if (!n) return;
        await f.player.doWork('kneel', 0.6, () => {});
        for (const g of grubs) g.hidden = true;
        give('huhu', n);
        fly(f, 'huhu', n, x, y - 6);
        game.save.vars[key] = dayNumber();
        game.persist();
        if (!F('wild:huhuTaken')) {
          setF('wild:huhuTaken');
          say('Koro says they taste like peanut butter. Raw. ...I\'m going to cook mine.', 'say', 3000);
          setTimeout(() => aroha(f, 'Eat them raw, ya sook! Or steam them at the hot pools, they go crunchy.', 'laugh'), 2600);
        }
      } finally { w.busy = false; }
    },
  } as Interactable);
}

// ================================================================== the ruru's tree

function buildRuru(f: FieldScene) {
  const x = WILD.ruru, y = gy(x) + 2;
  const sTree = sprite('wild:rimu', () => hollowTree(53));
  const sLip = sprite('wild:rimuLip', () => hollowLip(53));
  if (!sTree || !sLip) return;
  f.main.add(new Prop(sTree.f, x, y, -2.7, { foliage: false }));
  // the lip of the hollow (the tree's own pixels under the opening), in front of whoever is home
  f.main.add(new Prop(sLip.f, x, y, 31, { foliage: false }));
  (f.interact as Interactable[]).push({
    x, y: y - 18, w: 16, h: 30, standX: x - 22,
    label: 'Knock on the old trunk',
    enabled: () => !W(f).busy,
    action: async () => {
      const w = W(f);
      w.busy = true;
      try {
        await f.player.doWork('grab', 0.5, () => {});
        audio.play('woodCreak' as never, { vol: 0.5, pitch: 1.6 });
        void floatText({ text: 'tok · tok · tok', style: 'whisper', x, y: y - 30, ms: 1400 });
        const r = w.ruru;
        if (!r || r.gone || !ruruInHollow(r)) {
          setTimeout(() => say(f.night ? 'Nobody home. It\'s out hunting... listen.' : 'Hollow sounds. Hollow\'s empty.', 'think', 2400), 700);
          return;
        }
        ruruKnock(r);
        if (!F('wild:ruruSeen')) {
          setF('wild:ruruSeen');
          setTimeout(() => { audio.play('discover' as never, { vol: 0.5 }); say('Two big yellow eyes. A ruru! It looks... SO offended.', 'happy', 2800); }, 1600);
          setTimeout(() => aroha(f, 'Ruru. Morepork. Our old people said it watches over the forest. Be polite.', 'say'), 4400);
        }
      } finally { w.busy = false; }
    },
  } as Interactable);
}

// ================================================================== the deep pool

function buildPool(f: FieldScene) {
  const x = WILD.pool, top = gy(x) + 4;
  const p = eelPool(61);
  const sBed = sprite('wild:pool:bed', () => p.bed), sSurf = sprite('wild:pool:surf', () => p.surface), sBank = sprite('wild:pool:bank', () => p.bank);
  if (!sBed || !sSurf || !sBank) return;
  f.main.add(new Prop(sBed.f, x, top, 60.4, { foliage: false }));
  f.main.add(new Prop(sSurf.f, x, top, 61.5, { foliage: false }));
  f.main.add(new Prop(sBank.f, x, top, 61.8, { foliage: false }));
  const w = W(f);
  // ripples on the surface: a dropped grub, the eel breaking it
  f.main.add(new Custom(61.7, r => {
    for (const q of w.ripples) {
      const k = q.t / (q.big ? 1.4 : 1), a = Math.max(0, 1 - k) * 0.8;
      const rx = 2 + k * (q.big ? 16 : 10), ry = 0.8 + k * (q.big ? 4 : 2.6);
      const col = packColor(0.75, 0.9, 0.9, a);
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2;
        r.rect(Math.round(q.x + Math.cos(ang) * rx), Math.round(q.y + Math.sin(ang) * ry), 1, 1, col);
      }
    }
  }, dt => { for (const q of w.ripples) q.t += dt; w.ripples = w.ripples.filter(q => q.t < 1.5); }));
  TUNA_CTX.took = (_a, tx) => {
    w.ripples.push({ x: tx, y: top + 9, t: 0, big: true });
    if (!F('wild:tunaSeen')) {
      setF('wild:tunaSeen');
      audio.play('discover' as never, { vol: 0.6 });
      say('WHOA. That\'s an EEL. A huge one. It\'s as long as I am!', 'shout', 3000);
      setTimeout(() => aroha(f, 'Tuna! A longfin. The old ones in these pools are older than Koro.', 'say'), 2400);
    }
  };
  TUNA_CTX.splash = (_a, tx) => { w.ripples.push({ x: tx, y: top + 9, t: 0, big: true }); audio.play('splash' as never, { vol: 0.5, pitch: 0.8 }); };
  (f.interact as Interactable[]).push({
    x, y: top - 10, w: 40, h: 18, standX: x - 24,
    get label() { return has('huhu') ? 'Drop a huhu grub into the deep pool' : 'Look into the deep pool'; },
    enabled: () => !w.busy,
    action: async () => {
      w.busy = true;
      try {
        if (!has('huhu')) {
          await f.player.doWork('kneel', 1.2, () => {});
          say(F('wild:tunaSeen') ? 'It\'s down there under the bank. A grub would bring it up.' : 'Dark, and deeper than it looks. Something big just moved under the bank...', 'think', 2800);
          if (!F('wild:tunaSeen')) setTimeout(() => say('If I had something to drop in... a grub, maybe.', 'think', 2400), 2900);
          return;
        }
        await f.player.doWork('kneel', 0.5, () => {});
        remove('huhu', 1);
        f.hud?.refresh();
        const dx = x + 14 + rand.range(-8, 8);
        w.ripples.push({ x: dx, y: top + 9, t: 0, big: false });
        audio.play('splash' as never, { vol: 0.3, pitch: 1.5 });
        if (w.tuna && !w.tuna.gone) tunaFeed(w.tuna, dx);
      } finally { w.busy = false; }
    },
  } as Interactable);
}

// ================================================================== the glow-worm overhang

/** the colony as a photo subject: it shows (and counts) only in the dark */
class Glow {
  z = -2.75;
  p = 1;
  vx = 0;
  vy = 0;
  facing = 1;
  dead = false;
  gone = false;
  hidden = 0.95;
  eco = { attacksPlayer: 0, aggro: 0 };
  anger = 0;
  act = 'glow';
  behavior = 'idle';
  noticed = false;
  species = TITIWAI_ID;
  dark = 0;
  t = 0;
  constructor(readonly f: FieldScene, public x: number, public y: number, readonly fr: Frame, readonly bx: { x0: number; y0: number; x1: number; y1: number }) {}
  box() { return this.bx; }
  body = {
    bounds: (a: Glow) => a.box(),
    points: (a: Glow): [number, number][] => { const b = a.box(); const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2; return [[cx, cy], [b.x0 + 8, cy], [b.x1 - 8, cy], [cx, b.y0 + 3]]; },
  };
  photoInfo() {
    const on = this.dark > 0.55;
    return { species: this.species, behavior: on ? 'glowing' : 'idle', box: this.box(), pts: this.body.points(this), speed: 0, facing: 1, noticed: false, juvenile: false, p: 1, hidden: on ? 0 : 0.95 };
  }
  update(dt: number) {
    this.t += dt;
    const f = this.f, w = W(f);
    const tod = f.tod as string;
    const amb = f.night ? 1 : tod === 'dusk' ? 0.6 : 0;
    const want = Math.max(amb, w.sitDark);
    this.dark += (want - this.dark) * Math.min(1, dt * 1.2);
    this.hidden = this.dark > 0.55 ? 0 : 0.95;
  }
  draw(r: Renderer) {
    if (this.dark < 0.03) return;
    const a = this.dark * (0.82 + Math.sin(this.t * 1.7) * 0.1 + Math.sin(this.t * 4.3) * 0.05);
    r.emissive(1);
    r.draw(this.fr, this.x, this.y, 1, 1, 0, packColor(1, 1, 1, a));
    r.emissive();
  }
}

function buildOverhang(f: FieldScene) {
  const x = WILD.overhang, y = gy(x) + 2;
  const s = sprite('wild:overhang', () => overhang(71));
  if (!s || !s.g) return;
  f.main.add(new Prop(s.f, x, y, -2.8, { foliage: false }));
  const { h: H0, recessY, recessH } = OVERHANG;
  const rcy = y - H0 + recessY + recessH * 0.55, rw = OVERHANG.w * 0.36;
  const glow = new Glow(f, x, y, s.g, { x0: x + 2 - rw, y0: rcy - recessH * 0.62, x1: x + 2 + rw, y1: rcy + recessH * 0.4 });
  f.main.add(glow as never);
  f.animals.push(glow as unknown as Animal);
  const w = W(f);
  // sitting in the dark: the night closes in round Mori and the ceiling comes on over it
  let sat = 0, sx = 0;
  f.main.add(new Custom(70, r => {
    if (w.sitDark < 0.02) return;
    r.rect(x - 900, y - 600, 1800, 900, packColor(0.01, 0.02, 0.04, w.sitDark * 0.8));
    r.emissive(1);
    r.draw(s.g!, x, y, 1, 1, 0, packColor(1, 1, 1, w.sitDark * (0.85 + Math.sin(glow.t * 1.7) * 0.1)));
    r.emissive();
  }, dt => {
    const p = f.player;
    if (w.sitting) {
      sat += dt;
      w.sitDark = Math.min(1, sat / 3);
      // getting up (moving off) ends it; so does sitting there a long time
      if (Math.abs(p.x - sx) > 3 || sat > 22) {
        w.sitting = false;
        if (p.poseOverride === 'sitGround') p.poseOverride = null;
      }
    } else w.sitDark = Math.max(0, w.sitDark - dt / 1.2);
  }));
  (f.interact as Interactable[]).push({
    x, y: y - 14, w: 34, h: 24, standX: x - 6,
    get label() { return f.night ? 'Sit and watch the glow-worms' : 'Sit in the dark under the overhang'; },
    enabled: () => !w.sitting && !w.busy,
    action: () => {
      const p = f.player;
      w.sitting = true; sat = 0; sx = p.x;
      p.poseOverride = 'sitGround';
      if (!F('wild:titiwaiSeen')) {
        setF('wild:titiwaiSeen');
        setTimeout(() => say('Give it a minute... let your eyes adjust...', 'whisper', 2400), 400);
        setTimeout(() => { audio.play('discover' as never, { vol: 0.5 }); say('Oh. Oh wow. The whole ceiling\'s full of stars.', 'whisper', 3200); }, 3400);
        setTimeout(() => aroha(f, 'Titiwai. My nan said they\'re the stars that fell in the creek.', 'whisper'), 6400);
      }
    },
  } as Interactable);
}

// ================================================================== the hot pools

function buildGeo(f: FieldScene) {
  const x = WILD.geo, top = gy(x) + 4;
  const s = sprite('wild:geo', () => geoField(83));
  if (!s) return;
  f.main.add(new Prop(s.f, x, top, 60.4, { foliage: false }));
  const Wd = GEO.w + 6, x0 = x - Wd / 2;
  const at = (fx: number, fy: number): [number, number] => [x0 + fx * Wd, top + 2 + fy * GEO.h];
  const pots = GEO.pots.map(([mx, my]) => at(mx, my));
  const [poolX, poolY] = at(GEO.pool[0], GEO.pool[1]);
  const ventX = pots[2][0] - 14, ventY = gy(ventX) - 1;
  const bubbles: { x: number; y: number; t: number; r: number }[] = [];
  const steam: { x: number; y: number; t: number; life: number; vx: number }[] = [];
  let bt = 0, stt = 0;
  const mudC = packColor(0.36, 0.33, 0.29, 1), mudL = packColor(0.62, 0.58, 0.5, 1);
  f.main.add(new Custom(60.7, r => {
    // the mud blurps: a dome rising, bursting into a ring and a flick of drops
    for (const b of bubbles) {
      if (b.t < 0.4) { const k = b.t / 0.4, h = Math.round(k * 2); for (let i = -1; i <= 1; i++) r.rect(Math.round(b.x + i), Math.round(b.y - h + (i ? 1 : 0)), 1, 1, i ? mudC : mudL); }
      else {
        const k = (b.t - 0.4) / 0.5, rx = 1 + k * b.r, a = 1 - k;
        const c = packColor(0.3, 0.27, 0.24, a);
        for (let i = 0; i < 14; i++) { const ang = (i / 14) * Math.PI * 2; r.rect(Math.round(b.x + Math.cos(ang) * rx), Math.round(b.y + Math.sin(ang) * rx * 0.4), 1, 1, c); }
        if (k < 0.5) { r.rect(Math.round(b.x - 1 - k * 3), Math.round(b.y - 3 - k * 4 + k * k * 10), 1, 1, mudC); r.rect(Math.round(b.x + 1 + k * 3), Math.round(b.y - 2 - k * 3 + k * k * 10), 1, 1, mudC); }
      }
    }
  }, dt => {
    bt -= dt;
    if (bt <= 0) { bt = rand.range(0.25, 0.8); const p = pots[rand.int(0, pots.length - 1)]; bubbles.push({ x: p[0] + rand.range(-5, 5), y: p[1] + rand.range(-2, 2), t: 0, r: rand.range(3, 6) }); if (rand.chance(0.3)) audio.play('bubble' as never, { vol: 0.15, pitch: rand.range(0.5, 0.8) }); }
    for (const b of bubbles) b.t += dt;
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].t > 0.9) bubbles.splice(i, 1);
  }));
  // steam off the pool and the vent, drifting with the wind
  f.main.add(new Custom(61, r => {
    for (const q of steam) {
      const k = q.t / q.life, a = Math.sin(k * Math.PI) * 0.32;
      const sz = 1 + Math.round(k * 3);
      r.rect(Math.round(q.x), Math.round(q.y), sz, sz, packColor(0.95, 0.96, 0.95, a));
    }
  }, dt => {
    stt -= dt;
    const wind = (f.st as unknown as { wind?: number }).wind ?? 0;
    if (stt <= 0) {
      stt = 0.08;
      steam.push({ x: poolX + rand.range(-24, 24), y: poolY + rand.range(-4, 4), t: 0, life: rand.range(2.2, 3.6), vx: rand.range(-3, 3) });
      if (rand.chance(0.5)) steam.push({ x: ventX + rand.range(-2, 2), y: ventY, t: 0, life: rand.range(1.6, 2.6), vx: rand.range(-2, 2) });
    }
    for (const q of steam) { q.t += dt; q.y -= dt * (9 + q.t * 4); q.x += dt * (q.vx + wind * 8); }
    for (let i = steam.length - 1; i >= 0; i--) if (steam[i].t > steam[i].life) steam.splice(i, 1);
  }));
  const w = W(f);
  const SOAK = 'wild:soakHour';
  (f.interact as Interactable[]).push({
    x: poolX, y: gy(poolX) - 12, w: 26, h: 20, standX: poolX - 16,
    label: 'Soak your feet in the hot pool',
    enabled: () => !w.busy,
    action: async () => {
      w.busy = true;
      const p = f.player;
      try {
        p.poseOverride = 'sitGround';
        audio.play('stepWater' as never, { vol: 0.5, pitch: 0.8 });
        say(F('wild:soaked') ? 'Ahhh.' : 'Ow. Hot. HOT. ...okay. Okay, that\'s the best thing that\'s happened all week.', F('wild:soaked') ? 'happy' : 'say', 3000);
        setF('wild:soaked');
        await new Promise(res => setTimeout(res, 3200));
        refillStamina(1);
        floatNotice('Stamina restored', 1800);
        game.save.vars[SOAK] = dayNumber();
        game.persist();
      } finally { if (p.poseOverride === 'sitGround') p.poseOverride = null; w.busy = false; }
    },
  } as Interactable);
  (f.interact as Interactable[]).push({
    x: ventX, y: ventY - 12, w: 14, h: 18, standX: ventX - 14,
    get label() { return has('huhu') ? 'Steam the huhu grubs over the vent' : 'Hold your hands in the steam'; },
    enabled: () => !w.busy,
    action: async () => {
      w.busy = true;
      try {
        if (!has('huhu')) {
          await f.player.doWork('kneel', 1, () => {});
          say('Warm... and it smells like a thousand rotten eggs. I could cook on this.', 'think', 2600);
          return;
        }
        const n = count('huhu');
        await f.player.doWork('kneel', 1.6, () => {});
        audio.play('hiss' as never, { vol: 0.4, pitch: 0.8 });
        remove('huhu', n);
        give('huhu_cooked', n);
        fly(f, 'huhu_cooked', n, ventX, ventY - 8);
        say(F('wild:huhuCooked') ? 'Crispy.' : 'Steamed huhu. It smells like... buttered popcorn?', 'happy', 2600);
        setF('wild:huhuCooked');
      } finally { w.busy = false; }
    },
  } as Interactable);
}

// ================================================================== the kea

/** what a kea can get out of an open pack: food first, never Mori's gear or keys */
function pickForKea(): string | null {
  const ok = stacks().filter(s => s.n > 0 && ITEMS[s.id] && !['key', 'tool', 'gear', 'camera', 'quest'].includes(ITEMS[s.id].kind as string));
  if (!ok.length) return null;
  const food = ok.filter(s => ITEMS[s.id].kind === 'food');
  const pool = food.length ? food : ok;
  return pool[rand.int(0, pool.length - 1)].id;
}
function setupKea(f: FieldScene) {
  KEA_CTX.steal = () => {
    if (game.scene !== (f as never)) return null;
    const id = pickForKea();
    if (!id || !remove(id, 1)) return null;
    f.hud?.refresh();
    const name = (ITEMS[id]?.name ?? 'stuff').toLowerCase();
    say(`HEY! That's my ${name}! Come back here!`, 'shout', 2600);
    if (!F('wild:keaThief')) { setF('wild:keaThief'); setTimeout(() => aroha(f, 'Ha! Kea. Cheekiest birds alive. Never leave your bag open near one.', 'laugh'), 2000); }
    return id;
  };
  KEA_CTX.drop = (_a, item, x) => {
    if (game.scene !== (f as never)) return;
    dropOnGround([{ id: item, n: 1 }], { x, quiet: true });
    void floatText({ text: 'It dropped it. Bored already.', style: 'think', ms: 2200 });
  };
}

// ================================================================== hints and boot

/** the first time Mori comes near each one, a thought that says there is something to do there */
const HINTS: [string, () => number, string][] = [
  ['log', () => WILD.logs[1].x, 'That log\'s rotten right through. Wonder what lives under it.'],
  ['logS', () => WILD.logs[0].x, 'A rotten log. Koro says the good grubs live in those.'],
  ['ruru', () => WILD.ruru, 'That old rimu\'s got a hollow up there. Anyone home?'],
  ['pool', () => WILD.pool, 'The creek goes deep here, under the bank. Dark as tea.'],
  ['glow', () => WILD.overhang, 'The overhang\'s dripping. It\'s pitch black under there.'],
  ['geo', () => WILD.geo, 'Steam! Hot pools... and mud that\'s actually burping.'],
];

tuaHooks.build.push(f => {
  try {
    for (const L of WILD.logs) buildLog(f, L);
    buildRuru(f);
    buildPool(f);
    buildOverhang(f);
    buildGeo(f);
  } catch (e) { console.warn('[wild] build', e); }
});

const spawned = new WeakSet<FieldScene>();
tuaHooks.update.push(f => {
  const w = W(f);
  if (!spawned.has(f) && f.player) {
    spawned.add(f);
    try {
      const wl = WILD.logs.find(l => l.worm);
      if (wl) w.worm = spawnWorm(f, wl.x + 10, { hidden: true });
      w.ruru = spawnRuru(f, WILD.ruru - 1, gy(WILD.ruru) + 2 - HOLLOW.up + 1);
      // at night it hunts from the rimu's low dead branch
      const tx = WILD.ruru, tw = 15, lean = Math.round(HOLLOW.perchUp * 0.025);
      RURU_CTX.perch = () => [tx + lean + tw - 2 + HOLLOW.perchLen - 5, gy(tx) + 2 - HOLLOW.perchUp - 2 - Math.round((HOLLOW.perchLen - 5) * 0.28)];
      const px = WILD.pool, ptop = gy(px) + 4, half = (POOL.w + 8) / 2;
      w.tuna = spawnTuna(f, { x0: px - half + 12, x1: px + half - 12, surfaceY: ptop + 6, bottomY: ptop + POOL.h - 6, lairX: Math.round(px - half + (POOL.w + 8) * POOL.lair) });
      if (w.tuna) (w.tuna as unknown as { z: number }).z = 61;
      setupKea(f);
      for (const kx of WILD.kea) spawnKea(f, kx);
      WORM_CTX.squirt = () => { audio.play('hiss' as never, { vol: 0.25, pitch: 2.2 }); };
      WORM_CTX.slimed = () => {
        if (game.scene !== (f as never)) return;
        audio.play('hiss' as never, { vol: 0.35, pitch: 1.8 });
        say(F('wild:slimed') ? 'Ugh, again!' : 'AGH! It SPAT at me! It\'s... glue? I\'m glued to my own sleeve!', F('wild:slimed') ? 'say' : 'scared', 2800);
        setF('wild:slimed');
      };
    } catch (e) { console.warn('[wild] spawn', e); }
  }
  // the hints
  const p = f.player;
  if (!p) return;
  for (const [id, xf, text] of HINTS) {
    if (w.hinted.has(id) || F('wild:hint:' + id)) continue;
    if (Math.abs(p.x - xf()) < 150) { w.hinted.add(id); setF('wild:hint:' + id); say(text, 'think', 2800); break; }
  }
});
