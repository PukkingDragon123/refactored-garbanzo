// V12 Te Ara Matatū, chapter 3: the Mokotūrama, the lantern gecko of Te Ngahere Kānapanapa, for the
// field guide (art: src/art/v12/arc/glow.ts), with its ecology entry, its mind, its body and the API the
// glow forest uses (./ch3.ts):
//
//   By night it forages from one clump of glowing fungus to the next (forage), licks the sugary dew off
//   the caps (feed: photo 'feeding'), then holds its tail up over its back and swings the lantern on the
//   tip to bring the moths in (lure: photo 'glowing'), snapping them out of the air. Its lights pulse
//   down its body as it goes. It watches with huge eyes: a lit lamp, a moving shape, a footstep, and it
//   switches every light off at once and freezes, pressed flat (freeze: 'dark'); come closer and it
//   bolts (flee). By day it sleeps curled in a crevice, lights out.
//
// API
//   GLOW_ID, GLOW_SPECIES (the species list registers it)
//   GLOW_CTX { fungi(a): number[], lure(a), dimmed(a) }        (the scene fills it in)
//   spawnGlowGecko(f, x, { home? }): Animal
//   geckoBody(a): GeckoBody | null      its body: glowK (0..1 how lit it is now), drawGlow(r, a, k)
//   geckoLight(a): number               0..1 how much light it gives off right now

import type { Species } from '../../species';
import { ECO } from '../../wild/ecology';
import { Animal, SPECIALS, HOOKS } from '../../wild/animal';
import type { Body } from '../../wild/animal';
import type { Box } from '../../wild/world';
import type { FieldScene } from '../../scenes/field';
import type { Renderer, Frame } from '../../../gfx/renderer';
import { packColor } from '../../../gfx/renderer';
import { registerBeast } from '../../../art/beasts';
import { GECKO, GECKO_ANIMS, geckoFrame } from '../../../art/v12/arc/glow';
import { local, A } from '../../assets';
import { FUN } from '../../../ui/v10/funfacts';
import { WEB } from '../../../ui/v10/foodweb';
import { rand, clamp } from '../../../core/math';
import './items1';

export const GLOW_ID = 'mokoturama';
registerBeast(GLOW_ID, GECKO);

/** what the glow forest tells the geckos, and hears back */
export const GLOW_CTX = {
  /** where the glowing fungus clumps are (world x), to forage between */
  fungi: (_a: Animal): number[] => [],
  /** it is swinging its lantern: the moths come */
  lure: (_a: Animal): void => {},
  /** it has just put every light out (spooked) */
  dimmed: (_a: Animal): void => {},
};

const ph = (species: string, behavior: string) => ({ kind: 'photo' as const, species, behavior });

export const GLOW_SPECIES: Species = {
  id: GLOW_ID, name: 'Mokotūrama (lantern gecko)', sci: 'Hoplodactylus lucernarius', group: 'Reptile', sites: [], times: ['dusk', 'night'],
  rarity: 5, danger: 0, size: 'Up to 60 cm nose to lantern, about 400 g',
  blurb: 'A night gecko the size of a forearm, a cousin of the lost kawekaweau, living only in the valley of the glowing forest. By day it is a lump of wet bark. By night two rows of blue-green lights wake along its flanks and pulse down its body, and it lifts its fat tail over its back and swings the lantern on the tip to call the moths in. One false move and every light goes out at once.',
  behaviors: {
    glowing: 'Swinging its lantern (luring moths)', feeding: 'Licking the glowing dew', walking: 'Creeping between the fungi',
    resting: 'Resting, lights pulsing', dark: 'Gone dark (spooked)', fleeing: 'Bolting into the dark', sleeping: 'Asleep, lights out',
  },
  facts: [
    {
      id: 'mk-lure', cat: 'Behaviour', q: 'Why does the Mokotūrama hold its glowing tail up and swing it?', options: ['It is a lure: moths fly to the light and it snaps them out of the air', 'To warn other geckos off its patch', 'To keep its tail warm'], answer: 0,
      text: 'The lantern is a swollen tail tip packed with light-making cells. Raised over its back and swung slowly, it looks like a glowing fungus cap drifting in the dark, and moths cannot resist it. The gecko waits under it, mouth ready.',
      evidence: [ph(GLOW_ID, 'glowing')], hint: 'At night in the glowing forest, lantern off, crouched and still: watch for a light that sways when nothing else does.',
    },
    {
      id: 'mk-dew', cat: 'Diet', q: 'What is it licking off the glowing fungus?', options: ['A sweet dew the fungus weeps at night, and the tiny flies stuck in it', 'The fungus itself, which it eats whole', 'Rainwater: it never drinks from pools'], answer: 0,
      text: 'The glowcaps sweat a sugary syrup after dark that draws gnats and springtails. The gecko licks the caps clean, sugar, gnats and all, and spreads the fungus\'s spores from clump to clump on its feet. Some of the glow it shows may even come from the fungus it eats.',
      evidence: [ph(GLOW_ID, 'feeding')], hint: 'Watch the clumps of glowing fungus on the valley floor after dark. Get close enough to see its tongue, without it seeing you.',
    },
    {
      id: 'mk-dark', cat: 'Adaptation', q: 'Why does it switch all its lights off at once when startled?', options: ['A gecko made of lights is easy to find in the dark: going dark makes it vanish', 'It runs out of light', 'Its lights only work when it is calm and warm'], answer: 0,
      text: 'Its lights are its whole life: they feed it, and they could kill it. Anything that hunts by sight in the valley follows lights. So the gecko can shut every one down in a blink and press itself flat against the bark, and a hunter looking straight at it sees nothing at all.',
      evidence: [ph(GLOW_ID, 'dark'), ph(GLOW_ID, 'glowing')], hint: 'Let it see you once (it won\'t thank you), and photograph what it does next.',
    },
    {
      id: 'mk-eye', cat: 'Anatomy', q: 'Why are its eyes so huge, with no eyelids?', options: ['Big eyes gather light in the dark; like all geckos it has a clear scale over each eye and licks it clean', 'It is still a baby', 'The big eyes are fake, to scare predators'], answer: 0,
      text: 'Night geckos see colour by starlight, many times better than we do in the dark. There are no lids to blink: a clear spectacle scale covers each eye, and the gecko wipes it clean with its tongue.',
      evidence: [ph(GLOW_ID, 'resting'), ph(GLOW_ID, 'feeding'), ph(GLOW_ID, 'walking')], hint: 'A clear, close side-on photo of it in the dark.',
    },
  ],
  research: {
    habitat: 'Only in Te Ngahere Kānapanapa, the glowing forest in the sunken valley, where the canopy never lets the sun reach the floor and the fungi light the night. By day it sleeps wedged in the cracks of the giant figs.',
    diet: 'Moths drawn to its lantern; gnats, springtails and the sweet dew licked off the glowing fungus caps; now and then a small wētā.',
    anatomy: 'A big, heavy-bodied gecko, olive-brown with dark W chevrons edged pale, the skin granular with raised tubercles. Two rows of photophores along each flank and rings of them round the fat tail, which ends in a swollen light organ, the lantern. Wide toe pads for climbing; huge lidless gold eyes with slit pupils.',
    ecology: 'A gardener of the glow: it carries the fungi\'s spores from clump to clump on its feet. It is hunted by things that follow lights, which is why it keeps them on a hair trigger. Like the island\'s other geckos it bears live young, one or two a year.',
    behaviour: 'Out only at night. It forages along the valley floor from glowcap to glowcap, then raises its tail and lures moths. Spooked, it switches every light off at once and freezes; pushed, it bolts and goes dark again further off. Sit still in the dark long enough and it forgets you.',
    notes: [
      'Its lights ran down its body like a wave. I forgot to breathe.',
      'Aroha says Koro\'s old people called it a guardian of the night paths: if you follow the lantern gecko, you never lose the track. She says it with a straight face.',
      'It licked its own eyeball. Then it looked at me like I was the weird one.',
      'Lamp OFF, Mori. One flash of the torch and the whole valley went dark around me. Rude.',
    ],
    status: 'Only seen in one valley',
  },
};

// ---------------------------------------------------------------- the body: its frames and its lights

interface Cached { fr: Frame; gfr: Frame; ax: number; ay: number; w: number; h: number; head: [number, number]; pts: [number, number][] }
let owner: unknown = null;
const cache = new Map<string, Cached>();
function frameOf(anim: string, i: number, eye: string, juv: boolean): Cached {
  if (owner !== local) { cache.clear(); owner = local; }
  const key = `${anim}.${i}.${eye}.${juv ? 'j' : 'a'}`;
  let c = cache.get(key);
  if (!c) {
    const o = geckoFrame(anim, i, eye as never, juv);
    const b = o.buf, pts: [number, number][] = [];
    for (let y = 1; y < b.h; y += 2) for (let x = 1; x < b.w; x += 3) if (b.data[y * b.w + x] >>> 24 > 128) pts.push([x - o.ax, y - o.ay]);
    if (!pts.length) pts.push([0, -3]);
    c = { fr: local.add('arcgk:' + key, o.buf, o.ax, o.ay), gfr: local.add('arcgkg:' + key, o.glow, o.ax, o.ay), ax: o.ax, ay: o.ay, w: b.w, h: b.h, head: [o.head[0] - o.ax, o.head[1] - o.ay], pts };
    cache.set(key, c);
  }
  return c;
}
const ANIM_OF: Record<string, keyof typeof GECKO_ANIMS> = {
  idle: 'idle', rest: 'idle', walk: 'walk', forage: 'walk', run: 'run', flee: 'run', feed: 'lick', lick: 'lick', eat: 'lick',
  lure: 'glow', glow: 'glow', alert: 'alert', freeze: 'hide', hide: 'hide', sleep: 'sleep',
};
/** how lit it is in each act (the frames carry the pulses; this dims them all together) */
const LIT: Record<string, number> = { lure: 1, feed: 0.85, forage: 0.75, rest: 0.8, idle: 0.8, alert: 0.25, freeze: 0, flee: 0.05, sleep: 0.1 };

export class GeckoBody implements Body {
  t = rand.range(0, 4);
  cur: keyof typeof GECKO_ANIMS = 'idle';
  /** 0..1 how lit it is now (eases toward its act's level; switching off is near instant) */
  glowK = 0.7;
  private last: Cached | null = null;
  update(dt: number, a: Animal) {
    const name = ANIM_OF[a.anim] ?? ANIM_OF[a.act] ?? 'idle';
    if (name !== this.cur) { this.cur = name; this.t = 0; }
    const moving = name === 'walk' || name === 'run';
    this.t += dt * (moving ? clamp(Math.abs(a.vx) / Math.max(8, name === 'run' ? a.eco.run * 0.8 : a.eco.walk), 0.4, 1.8) : 1);
    const want = LIT[a.act] ?? 0.7;
    this.glowK += (want - this.glowK) * Math.min(1, dt * (want < this.glowK ? 9 : 1.4));
  }
  private frame(a: Animal): Cached {
    const info = GECKO_ANIMS[this.cur];
    const n = Math.floor(this.t * info.fps);
    const i = info.loop ? n % info.frames : Math.min(info.frames - 1, n);
    const eye = this.cur === 'sleep' ? 'closed' : this.cur === 'alert' || a.eye === 'scared' ? 'alert' : 'open';
    this.last = frameOf(this.cur, i, eye, a.juvenile);
    return this.last;
  }
  draw(r: Renderer, a: Animal) {
    if (a.hidden >= 0.98) return;
    const f = this.frame(a), s = a.scale;
    const alpha = a.alpha * (1 - a.hidden * 0.55);
    if (a.hidden < 0.5) {
      r.beginShadows();
      r.draw(A.shadow, a.x, a.y, Math.max(0.35, (f.w * s) / 40), 0.6, 0, packColor(0, 0, 0, 0.3 * alpha));
      r.endShadows();
    }
    r.draw(f.fr, a.x, a.y, a.facing * s, s, 0, packColor(1, 1, 1, alpha));
    this.drawGlow(r, a, 1);
  }
  /** its lights alone (the scene draws them again over its darkness) */
  drawGlow(r: Renderer, a: Animal, k: number) {
    const f = this.last ?? this.frame(a);
    const g = this.glowK * k * a.alpha;
    if (g < 0.02 || a.hidden >= 0.98) return;
    r.emissive(1);
    r.draw(f.gfr, a.x, a.y, a.facing * a.scale, a.scale, 0, packColor(1, 1, 1, Math.min(1, g)));
    r.emissive();
  }
  bounds(a: Animal): Box {
    const f = this.last ?? this.frame(a), s = a.scale;
    const l = -f.ax * s, rr = (f.w - f.ax) * s;
    return { x0: a.facing > 0 ? a.x + l : a.x - rr, y0: a.y - f.ay * s, x1: a.facing > 0 ? a.x + rr : a.x - l, y1: a.y + (f.h - f.ay) * s };
  }
  head(a: Animal): [number, number] {
    const f = this.last ?? this.frame(a);
    return [a.x + f.head[0] * a.facing * a.scale, a.y + f.head[1] * a.scale];
  }
  points(a: Animal): [number, number][] {
    const f = this.last ?? this.frame(a), s = a.scale;
    return f.pts.map(([x, y]) => [a.x + x * a.facing * s, a.y + y * s] as [number, number]);
  }
}
export const geckoBody = (a: Animal | null | undefined): GeckoBody | null => (a?.body instanceof GeckoBody ? a.body : null);
/** 0..1 the light it gives off now */
export const geckoLight = (a: Animal) => (geckoBody(a)?.glowK ?? 0) * (a.hidden > 0.9 ? 0 : 1);

// ---------------------------------------------------------------- its mind
ECO[GLOW_ID] = {
  loco: 'walker', medium: 'ground', walk: 13, run: 78, bold: 0.25, aggro: 0, curious: 0.15, social: 0, alert: 0.8,
  sight: 140, hear: 1.4, nocturnal: true, flightDist: 64, food: ['insect', 'nectar'], defense: ['freeze', 'flee'],
  group: [1, 1], calls: { contact: 'callClick', alarm: 'callClick' }, size: 1,
  idle: [{ act: 'forage', w: 3, dur: [6, 14] }, { act: 'feed', w: 1.6, dur: [5, 9] }, { act: 'lure', w: 1.6, dur: [6, 10] }, { act: 'rest', w: 0.8, dur: [3, 6] }],
  photo: { lure: 'glowing', feed: 'feeding', forage: 'walking', walk: 'walking', rest: 'resting', idle: 'resting', alert: 'resting', freeze: 'dark', flee: 'fleeing', sleep: 'sleeping' },
};

const pl = (a: Animal) => a.host.player;
/** the next clump of fungus to go to: one it isn't at, not too far, inside its range */
function nextFungus(a: Animal): number {
  const xs = GLOW_CTX.fungi(a).filter(x => x > a.home[0] && x < a.home[1] && Math.abs(x - a.x) > 18 && Math.abs(x - a.x) < 260);
  if (xs.length) return xs[rand.int(0, xs.length - 1)];
  return clamp(a.x + (rand.chance(0.5) ? -1 : 1) * rand.range(40, 110), a.home[0], a.home[1]);
}

SPECIALS[GLOW_ID] = {
  ...(SPECIALS[GLOW_ID] ?? {}),
  forage(a, dt) {
    a.hidden = 0;
    if (a.mem.tx === undefined) a.mem.tx = nextFungus(a);
    // a creep with pauses: geckos go in little bursts
    const k = Math.floor(a.actT / 1.4);
    if (k % 3 === 2) { a.vx = 0; a.anim = 'idle'; return; }
    a.anim = 'walk';
    if (a.groundTo(a.mem.tx, a.eco.walk, dt) || a.mem.blocked) { a.vx = 0; a.mem.blocked = 0; a.setAct('feed', rand.range(5, 9)); }
  },
  feed(a) {
    a.vx = 0; a.anim = 'lick'; a.hidden = 0;
    if (a.actT > a.actDur) { if (rand.chance(0.65)) a.setAct('lure', rand.range(6, 10)); else return false; }
  },
  lure(a, dt) {
    a.vx = 0; a.anim = 'glow'; a.hidden = 0;
    if (Math.floor(a.actT / 2.2) !== Math.floor((a.actT - dt) / 2.2)) GLOW_CTX.lure(a);
    if (a.actT > a.actDur) return false;
  },
  rest(a) { a.vx = 0; a.anim = 'idle'; a.hidden = 0; },
  /** spooked: every light out, pressed flat, still as bark */
  freeze(a) {
    a.vx = 0; a.anim = 'hide';
    if (!a.mem.d) { a.mem.d = 1; GLOW_CTX.dimmed(a); a.host.sfx('callClick', a.x, 0.18, 1.6); }
    const p = pl(a), d = Math.abs(p.x - a.x);
    if (d < 34 && a.actT > 0.4) { a.setAct('flee', rand.range(2.5, 4)); return; }
    if (a.actT > a.actDur) { if (a.aw > 0.6 && d < 120) { a.actDur = a.actT + 2; return; } a.setAct('rest', rand.range(1.5, 3)); }
  },
  /** bolting into the dark, away from what scared it, then gone dark again */
  flee(a, dt) {
    a.hidden = 0;
    const p = pl(a);
    if (a.mem.tx === undefined) a.mem.tx = clamp(a.x + (a.x < p.x ? -1 : 1) * rand.range(110, 180), a.home[0] - 60, a.home[1] + 60);
    a.anim = 'run';
    if (a.groundTo(a.mem.tx, a.eco.run, dt) || a.mem.blocked || a.actT > a.actDur) { a.vx = 0; a.mem.blocked = 0; a.setAct('freeze', rand.range(4, 7)); }
  },
  /** by day: curled in a crack, lights out */
  sleep(a) { a.vx = 0; a.anim = 'sleep'; a.hidden = 0.6; },
};
HOOKS[GLOW_ID] = {
  ...(HOOKS[GLOW_ID] ?? {}),
  onThreat(a) {
    const d = Math.abs(pl(a).x - a.x);
    if (a.act === 'flee' || a.act === 'freeze') return true;
    if (d < 36) a.setAct('flee', rand.range(2.5, 4));
    else a.setAct('freeze', rand.range(4, 7));
    return true;
  },
};

/** put a lantern gecko in the scene at x */
export function spawnGlowGecko(f: FieldScene, x: number, o: { home?: [number, number] } = {}): Animal {
  const a = new Animal(GLOW_ID, x, f.st.terrain.groundY(x), { home: o.home ?? [x - 220, x + 220], medium: 'ground' });
  a.host = f;
  a.facing = rand.chance(0.5) ? 1 : -1;
  a.settle();
  a.body = new GeckoBody();
  f.animals.push(a);
  f.main.add(a);
  a.setAct(f.tod === 'night' || f.tod === 'dusk' ? 'feed' : 'sleep', rand.range(4, 8));
  return a;
}

FUN[GLOW_ID] = 'A lantern gecko can switch every one of its lights off in under a tenth of a second: faster than you can blink.';
WEB.push(
  [GLOW_ID, 'eats', 'skymoth', 'lured in by the lantern on its tail'],
  [GLOW_ID, 'eats', 'lanternbeetle', 'snapped up under the glowcaps'],
);
