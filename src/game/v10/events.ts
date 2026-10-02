// V10 expedition events: so no two trips are the same. Each time an expedition scene opens, one or
// two events are drawn from those that fit the place, the time and the story so far (some are one-
// offs, some come back every few days), and they happen a little while into the visit: the weather
// turns, an animal turns up, Aroha teaches something, a snared animal needs freeing, a bottle washes
// up, somebody else's boot prints, a rockfall closes a way on, one of Joshu's lost things, Jenna on the
// radio, fog, a tremor, a thieving bird, a rainbow, Aroha's stories, nightfall...
// State (what happened when): game.save.v10.events.

import { game } from '../game';
import type { TripRun } from './field10';
import type { BubbleLine } from '../../ui/bubbles';
import { bucket } from './store';
import { dayNumber } from './day';
import { location, LOCATIONS, isFound, rumour, addNote, discover } from './regions';
import { expeditionHour, passTime } from './expedition';
import { spend, restore } from './energy';
import { add, count, remove, stacks } from '../inventory';
import { ITEMS } from '../items';
import { SPECIES_BY_ID } from '../species';
import { findArt } from './finds';
import { Custom } from '../../world/props';
import { packColor } from '../../gfx/renderer';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { rand } from '../../core/math';
import { tr } from './translator';

interface EvState { last: Record<string, number>; n: Record<string, number>; log: { day: number; id: string; loc: string }[] }
const S = () => bucket<EvState>('events', () => ({ last: {}, n: {}, log: [] }));

export interface TripEvent {
  id: string;
  /** relative weight when drawing */
  w: number;
  /** happens only once ever */
  once?: boolean;
  /** days before it can happen again */
  every?: number;
  /** fits this place and moment */
  fits: (r: TripRun) => boolean;
  run: (r: TripRun) => Promise<void> | void;
}

const sleep = (ms: number) => new Promise<void>(res => setTimeout(res, ms));
const kindOf = (r: TripRun) => location(r.loc)?.kind ?? 'site';
const WET = new Set(['coast', 'mangrove', 'grotto', 'isle-stream', 'isle-seals', 'isle-cave', 'isle-wreck', 'deep', 'falls']);
const OPEN = new Set(['fernwood', 'canopy', 'falls', 'mangrove', 'coast', 'fossils', 'geovalley', 'ruins', 'village', 'unknown']);
const hasAroha = (r: TripRun) => !!r.guide;
const free = (r: TripRun) => !r.f.cutscene && !game.ui.blocking && !game.ui.bubbles.active;

/** say lines; Aroha's through the translator (and only if she came) */
function talk(r: TripRun, lines: BubbleLine[]) {
  const ls = lines.filter(l => l.who !== 'aroha' || hasAroha(r)).map(l => (l.who === 'aroha' ? { ...l, ...tr(l.text, { style: l.style }) } : l));
  return ls.length ? r.f.say(ls) : Promise.resolve(-1);
}
/** Jenna over the walkie-talkie (no one standing there: the bubble docks at the top) */
function radio(r: TripRun, lines: string[], expr = 'neutral') {
  game.ui.bubbles.register('jenna', { name: 'Jenna · radio', voice: 1.5, color: '#d04890', anchor: () => null });
  audio.play('scanBeep' as never, { vol: 0.4 });
  return r.f.say(lines.map(t => ({ who: 'jenna', text: `<i>*kssht*</i> ${t}`, expr })));
}
const note = (r: TripRun, id: string, text: string) => addNote({ id, loc: r.loc, x: Math.round(r.p.x), text });

// ------------------------------------------------------------------ the events
export const EVENTS: TripEvent[] = [
  {
    id: 'rain', w: 3, every: 2, fits: r => OPEN.has(r.loc) || kindOf(r) === 'site',
    run: async r => {
      await talk(r, [{ who: 'aroha', text: 'Smell that? Rain, coming in fast. The animals will hide: find cover, or get wet.', expr: 'serious' }]);
      audio.play('thunder' as never, { vol: 0.35 });
      let t = 70;
      const lp = r.f.main.particles;
      r.tickers.push(dt => {
        if (t <= 0) return;
        t -= dt;
        for (let i = 0; i < 6; i++) lp.spawn({ frame: A.dot2, x: r.f.st.cam.x + rand.range(-340, 340), y: r.f.st.cam.y - 200, vx: -30, vy: 380, life: 0.9, color: [0.7, 0.8, 0.95], alpha: 0.6, alpha1: 0.3, size: 0.5, floorY: r.groundAt(r.f.st.cam.x) + 4, onFloor: 'die' });
        if (rand.chance(dt * 0.5)) spend(0.5, 'rain');
      });
      passTime(0.25);
      note(r, 'note:rain:' + dayNumber(), 'Caught in a downpour here.');
    },
  },
  {
    id: 'encounter', w: 4, every: 1, fits: r => (r.f.site.spawns?.length ?? 0) > 0,
    run: async r => {
      const sp = rand.pick(r.f.site.spawns.filter(s => !s.medium || s.medium === 'ground' || s.medium === 'air'));
      if (!sp) return;
      const dir = r.p.facing || 1;
      const x = Math.max(60, Math.min(r.f.site.width - 60, r.p.x + dir * rand.range(200, 300)));
      r.f.spawnRule({ ...sp, n: [1, 2], x: [x - 30, x + 30], chance: 1, poi: undefined, later: false, times: undefined, when: undefined }, false);
      const name = SPECIES_BY_ID[sp.species]?.name ?? sp.species;
      await talk(r, [
        { who: 'aroha', text: `Stop. Don’t move. Up ahead: a ${name}. It hasn’t seen us. Camera, Mori. Slowly.`, expr: 'serious', style: 'whisper' },
      ]);
      r.p.body.showEmote('exclaim', 1.2);
    },
  },
  {
    id: 'lesson', w: 3, every: 1, fits: hasAroha,
    run: async r => {
      const L = rand.pick(LESSONS);
      await talk(r, [{ who: 'aroha', text: L[0], expr: 'happy' }, { who: 'mori', text: L[1], expr: 'thinking' }]);
      note(r, 'note:lesson:' + L[2], L[2]);
    },
  },
  {
    id: 'snare', w: 2, every: 3, fits: r => kindOf(r) === 'site' && r.loc !== 'deep',
    run: async r => {
      const x = Math.min(r.f.site.width - 80, r.p.x + (r.p.facing || 1) * 180);
      const who = rand.pick(['delver', 'quillhog', 'shieldback']);
      const name = SPECIES_BY_ID[who]?.name ?? who;
      let done = false;
      r.addFind({
        id: 'ev:snare:' + dayNumber() + ':' + r.loc, kind: 'landmark', name: `Snared ${name}`, x, art: () => findArt.glint('#8a6a44'), when: () => !done,
        look: { verb: `Free the trapped ${name}`, lines: () => [] },
        after: () => {
          if (done) return;
          done = true;
          game.save.vars['v10:freed'] = (game.save.vars['v10:freed'] ?? 0) + 1;
          audio.play('rope', { vol: 0.5 });
          r.f.spawnRule({ species: who, n: [1, 1], x: [x, x + 4], chance: 1 }, false);
          void talk(r, [
            { who: 'mori', text: `Easy... easy... there. Off you go, little ${name}.`, expr: 'happy' },
            { who: 'aroha', text: 'That snare is old, from my grandfather’s grandfather’s time. Somebody should have taken it up. Thank you.', expr: 'happy' },
          ]);
          note(r, 'note:freed:' + dayNumber(), `Freed a ${name} from an old snare.`);
        },
      });
      await talk(r, [{ who: 'aroha', text: 'Listen... something is squeaking. Over there. It’s caught in something!', expr: 'worried' }]);
    },
  },
  {
    id: 'bottle', w: 2, once: true, fits: r => WET.has(r.loc) && count('art_bottle') === 0,
    run: async r => {
      const x = Math.min(r.f.site.width - 80, r.p.x + (r.p.facing || 1) * 140);
      r.addFind({ id: 'art_bottle', kind: 'artifact', name: 'A bottle with a letter', x, art: () => findArt.glint('#4a8a5a'), note: 'A message in a bottle from 1912.',
        take: { item: 'art_bottle', verb: 'Pick up the bottle', time: 1.4, line: 'A letter inside. 1912! “The serpents are real. Tell my wife I was right.” ...Someone was here before us.' },
        after: () => rumour('coast') });
      await talk(r, [{ who: 'mori', text: 'Something green is glinting in the water. A bottle?', expr: 'surprised' }]);
    },
  },
  {
    id: 'rival', w: 2, every: 4, fits: r => OPEN.has(r.loc) && (game.save.vars['v10:rival'] ?? 0) < 3,
    run: async r => {
      const n = game.save.vars['v10:rival'] = (game.save.vars['v10:rival'] ?? 0) + 1;
      const x = r.p.x + (r.p.facing || 1) * 120;
      // boot prints in the mud that are not ours
      r.f.main.add(new Custom(-9.6, rr => { rr.beginShadows(); for (let i = 0; i < 9; i++) { const px = x + i * 14; rr.draw(A.shadow, px, r.groundAt(px) + 4 + (i % 2) * 2, 0.26, 0.1, 0, packColor(0, 0, 0, 0.5)); } rr.endShadows(); }));
      if (n === 1) {
        await talk(r, [
          { who: 'mori', text: 'Boot prints. Big ones, with a zigzag tread. Those aren’t mine. They aren’t Joshu’s either.', expr: 'worried' },
          { who: 'aroha', text: 'Nobody from my village wears boots like that. Somebody else is on the island.', expr: 'serious' },
        ]);
        note(r, 'note:rival1', 'Boot prints. Not ours!');
      } else if (n === 2) {
        r.addFind({ id: 'art_tag', kind: 'artifact', name: 'A yellow sample tag', x: x + 130, art: () => findArt.glint('#e8c020'), note: 'HELIX BIOPROSPECTING · SAMPLE 0417.',
          take: { item: 'art_tag', verb: 'Pick up the yellow tag', time: 1.2, line: '“Helix Bioprospecting. Do not remove.” Brand new. Someone is collecting samples here. For money.' } });
        await talk(r, [{ who: 'mori', text: 'The zigzag boots again. And something yellow tied to that branch...', expr: 'serious' }]);
        note(r, 'note:rival2', 'The zigzag boots again. A sample tag.');
      } else {
        await radio(r, ['Mori? Dad says there’s smoke on the east headland. Not ours. Somebody else has a camp out there. Be careful, okay?'], 'worried');
        note(r, 'note:rival3', 'Jenna: smoke from a strange camp on the east headland.');
        rumour('coast');
      }
    },
  },
  {
    id: 'rockfall', w: 2, every: 3, fits: r => LOCATIONS.some(l => l.routes?.some(rt => rt.from === r.loc)) && ['fossils', 'falls', 'ruins', 'canopy', 'fernwood', 'geovalley', 'grotto'].includes(r.loc),
    run: async r => {
      const ways = LOCATIONS.filter(l => l.routes?.some(rt => rt.from === r.loc));
      const to = rand.pick(ways);
      r.f.st.shake(4, 1.2);
      audio.play('thunderClose' as never, { vol: 0.5 });
      r.blocked.set(to.id, 'a rockfall has closed it');
      const [pick] = [await talk(r, [
        { who: 'aroha', text: 'Rockfall! Get back! ...That was the way on. It’s buried.', expr: 'scared', style: 'shout' },
        { who: 'mori', text: 'There might be a way around, over the top. It won’t be easy.', expr: 'worried', choices: ['Climb around it (−10 energy, 1 h)', 'Leave it for today'] },
      ])];
      if (pick === 0) {
        spend(10, 'detour');
        passTime(1);
        r.blocked.delete(to.id);
        game.ui.toast('You found a way over the rubble. The way on is open.', 'DETOUR', 'teal', 3000);
      } else note(r, 'note:rockfall:' + dayNumber(), 'Rockfall closed the way on.');
    },
  },
  {
    id: 'joshu', w: 2, fits: r => ['joshu_compass', 'joshu_cap', 'joshu_log'].some(id => !game.save.flags['v10:found:' + id]) && (WET.has(r.loc) || kindOf(r) === 'site'),
    run: async r => {
      const id = ['joshu_compass', 'joshu_cap', 'joshu_log'].find(i => !game.save.flags['v10:found:' + i])!;
      const x = Math.min(r.f.site.width - 80, r.p.x + (r.p.facing || 1) * 160);
      r.addFind({ id: 'joshu:' + id, kind: 'landmark', name: ITEMS[id].name, x, art: () => findArt.glint(id === 'joshu_cap' ? '#b0342a' : '#c8a040'),
        take: { item: id, verb: `Pick up ${ITEMS[id].name.replace('Joshu’s ', 'the ')}`, time: 1.2, line: id === 'joshu_compass' ? 'Joshu’s compass! With the photo of little Jenna inside. He’s going to cry. He’ll say it’s the wind.' : id === 'joshu_cap' ? 'Joshu’s spare cap. Something chewed it. It smells... of pipe smoke and regret.' : 'Pages from the ship’s log. “Something big under the hull. Not a whale.”' },
        after: () => { game.save.flags['v10:found:' + id] = true; } });
      await talk(r, [{ who: 'mori', text: 'Wait. I know that colour. That’s from the Kittiwake!', expr: 'surprised' }]);
    },
  },
  {
    id: 'radio', w: 3, every: 1, fits: r => r.loc !== 'deep' && r.loc !== 'grotto' && r.loc !== 'unknown',
    run: async r => {
      const lvl = game.save.vars['v10:translator'] ?? 0;
      const opts: string[][] = [
        ['Jenna to Mori, Jenna to Mori. Chunk ate a whole sock. Not a bit of sock. A WHOLE sock. Over.'],
        ['Weather check from Dad: wind coming round to the south this afternoon. Don’t stay out too late!'],
        [lvl < 3 ? 'How’s the translator? If it calls anyone a potato again, tap it twice. Firmly. With love.' : 'Translator v2.0 holding up? I’m SO proud of that little guy.'],
        ['Did you find anything cool? Bring me something shiny. For science. Mostly for me.'],
        ['Kevin the crab says hi. ...Okay, Kevin said nothing. Kevin is a crab. Over and out.'],
      ];
      await radio(r, rand.pick(opts), 'happy');
    },
  },
  {
    id: 'fog', w: 2, every: 2, fits: r => ['fernwood', 'canopy', 'falls', 'mangrove', 'ruins', 'unknown', 'coast'].includes(r.loc),
    run: async r => {
      let t = 60;
      const prev = r.f.st.envHook;
      r.f.st.envHook = (env, dt) => {
        prev?.(env, dt);
        const k = Math.max(0, Math.min(1, t / 8, (60 - t) / 6)) * 0.7;
        env.fogTop = [env.fogTop[0] + (0.8 - env.fogTop[0]) * k, env.fogTop[1] + (0.84 - env.fogTop[1]) * k, env.fogTop[2] + (0.86 - env.fogTop[2]) * k];
        env.fogBottom = [env.fogBottom[0] + (0.86 - env.fogBottom[0]) * k, env.fogBottom[1] + (0.9 - env.fogBottom[1]) * k, env.fogBottom[2] + (0.9 - env.fogBottom[2]) * k];
        env.contrast -= 0.2 * k;
      };
      r.tickers.push(dt => { t = Math.max(0, t - dt); });
      await talk(r, [{ who: 'aroha', text: 'Fog. Stay close to me: in fog, every tree looks like the tree you just passed.', expr: 'serious' }]);
    },
  },
  {
    id: 'tremor', w: 1, every: 5, fits: r => ['fossils', 'geovalley', 'unknown', 'ruins', 'falls'].includes(r.loc),
    run: async r => {
      r.f.st.shake(5, 2.2);
      audio.play('thunderClose' as never, { vol: 0.6, pitch: 0.6 });
      for (let i = 0; i < 30; i++) r.f.main.particles.spawn({ frame: A.dot2, x: r.p.x + rand.range(-300, 300), y: r.f.st.cam.y - 180, vx: 0, vy: rand.range(40, 90), ay: 300, life: 1.6, color: [0.6, 0.55, 0.45], alpha: 0.8, alpha1: 0.2, floorY: r.groundAt(r.p.x) + 2 });
      await talk(r, [
        { who: 'mori', text: 'Earthquake! Everybody... nobody panic! I’m panicking!', expr: 'scared', style: 'shout' },
        { who: 'aroha', text: 'Rūaumoko turning over in his sleep. The land here is young and restless. It has stopped. Breathe.', expr: 'serious' },
      ]);
      note(r, 'note:tremor:' + dayNumber(), 'Felt an earthquake here.');
    },
  },
  {
    id: 'thief', w: 2, every: 3, fits: r => stacks().some(s => ITEMS[s.id]?.kind === 'food') && ['fernwood', 'canopy', 'falls', 'ruins', 'village', 'coast', 'isle-grove'].includes(r.loc),
    run: async r => {
      const food = stacks().find(s => ITEMS[s.id]?.kind === 'food');
      if (!food) return;
      const name = ITEMS[food.id].name;
      remove(food.id, 1);
      r.f.hud?.refresh();
      audio.play('wingFlap' as never, { vol: 0.6 });
      r.p.body.react('jump');
      await talk(r, [
        { who: 'mori', text: `HEY! That bird just took my ${name.toLowerCase()}! Right out of the side pocket!`, expr: 'angry', style: 'shout' },
        { who: 'aroha', text: 'Ha! A kākā-cousin. They’re clever. Next time, zip your pockets.', expr: 'laugh' },
      ]);
    },
  },
  {
    id: 'rainbow', w: 1, every: 4, fits: r => ['falls', 'geovalley', 'coast', 'isle-stream'].includes(r.loc) && (expeditionHour() % 24) < 17,
    run: async r => {
      const x = r.p.x + (r.p.facing || 1) * 160;
      let t = 45;
      r.f.main.add(new Custom(-8, rr => {
        if (t <= 0) return;
        const k = Math.min(1, t / 6) * 0.35;
        const cols: [number, number, number][] = [[1, 0.3, 0.3], [1, 0.7, 0.3], [1, 1, 0.4], [0.4, 1, 0.4], [0.4, 0.6, 1], [0.7, 0.4, 1]];
        for (let a = 0; a < Math.PI; a += 0.04) cols.forEach((c, i) => rr.fxDraw(A.dot, x + Math.cos(a) * (110 - i * 3), 260 - Math.sin(a) * (110 - i * 3), 0.9, 0.9, 0, packColor(c[0], c[1], c[2], 1), k));
      }, dt => { t -= dt; }));
      r.addFind({ id: 'lm:rainbow:' + r.loc, kind: 'landmark', name: 'A rainbow', x, photo: { w: 220, h: 120, dy: 20 }, note: 'A rainbow over the spray.', when: () => t > 0 });
      await talk(r, [{ who: 'aroha', text: 'Look! Te Āniwaniwa. A rainbow. Quick, before it fades.', expr: 'happy' }]);
    },
  },
  {
    id: 'story', w: 2, fits: r => hasAroha(r) && STORIES.some(s => s.at === r.loc && !isFound(s.tells) && !game.save.flags['v10:story:' + s.tells]),
    run: async r => {
      const st = STORIES.find(s => s.at === r.loc && !isFound(s.tells) && !game.save.flags['v10:story:' + s.tells])!;
      game.save.flags['v10:story:' + st.tells] = true;
      await talk(r, st.lines.map(([who, text, expr]) => ({ who, text, expr })));
      rumour(st.tells);
      game.ui.toast(`Heard of: <b>${location(st.tells)?.secret ? '???' : location(st.tells)?.name}</b>. A "?" on your map.`, 'MAP', 'teal', 3200);
    },
  },
  {
    id: 'nightfall', w: 9, every: 1, fits: r => (expeditionHour() % 24) >= 18 && r.loc !== 'village',
    run: async r => {
      await talk(r, [
        { who: 'aroha', text: 'The light is going, Mori. Out here in the dark, we become the ones being watched. Time to head home.', expr: 'worried' },
        { who: 'mori', text: 'Five more minutes. ...Okay, three. Okay, okay, we’re going.', expr: 'tired' },
      ]);
    },
  },
  {
    id: 'honey', w: 1, every: 4, fits: r => ['fernwood', 'canopy', 'ruins', 'village', 'isle-grove'].includes(r.loc),
    run: async r => {
      const x = Math.min(r.f.site.width - 80, r.p.x + (r.p.facing || 1) * 150);
      let taken = false;
      r.addFind({ id: 'ev:honey:' + dayNumber() + r.loc, kind: 'plant', name: 'Wild honeycomb', x, art: () => findArt.glint('#e0a020'), when: () => !taken,
        look: { verb: 'Break off a piece of wild honeycomb', lines: () => [{ who: 'mori', text: 'Mmmf. Sweet. Like flowers and sunshine and slightly angry bees.', expr: 'happy' }] },
        after: () => { if (taken) return; taken = true; restore(12); game.ui.toast('+12 energy', 'HONEY', 'teal', 2000); } });
      await talk(r, [{ who: 'aroha', text: 'Bees in that hollow log. Rātā honey! Take a little, leave them the rest.', expr: 'happy' }]);
    },
  },
];

const LESSONS: [string, string, string][] = [
  ['Kawakawa: chew the leaf for a sore tooth. The ones with holes are best: the caterpillars know.', 'Note: caterpillars are pharmacists.', 'Kawakawa leaves with holes: best for medicine.'],
  ['When a fern frond is silver underneath, lay it silver side up: you can find your way back by moonlight.', 'A trail of silver ferns. That’s beautiful.', 'Silver fern fronds mark a trail home.'],
  ['Pīwakawaka, the fantail, follows you to eat the insects you stir up. Some say it brings messages.', 'So the fantail is basically a tiny postman.', 'Fantails follow walkers for the insects.'],
  ['Never walk between a mother and her young. Not for bonefaces, not for people.', 'Writing that one down twice.', 'Never walk between a mother and her young.'],
  ['Harakeke flowers feed the birds. That’s why we never cut the flower stalks.', 'Flax: bird café. Got it.', 'Leave flax flowers for the birds.'],
  ['Wet moss on the south side of the trunks. If you’re lost, it tells you where the cold wind comes from.', 'Nature’s compass. Mossy.', 'Moss grows on the cold side of trunks.'],
  ['Whakataukī: “Ka mua, ka muri.” Walk backwards into the future: look at the past to see where you’re going.', 'That’s... actually really good advice for a scientist.', '“Ka mua, ka muri”: learn from the past.'],
];
const STORIES: { at: string; tells: string; lines: [string, string, string][] }[] = [
  { at: 'mangrove', tells: 'village', lines: [['aroha', 'Up this river, past where the water turns clear, is my village. Te Kāinga. If we follow the canoe marks, I can take you home.', 'happy'], ['mori', 'Your home? I’d be honoured.', 'happy']] },
  { at: 'canopy', tells: 'ruins', lines: [['aroha', 'Across the gap, on the next ridge: see the stone? That was a pā of my tūpuna, a long time ago.', 'serious']] },
  { at: 'falls', tells: 'fossils', lines: [['aroha', 'Above the falls the gorge is full of bones in the rock. My koro calls it Te Toka Iwi. Hard climbing.', 'neutral']] },
  { at: 'fossils', tells: 'glowforest', lines: [['aroha', 'There’s a valley under this gorge where the forest shines at night, and in the day too. I’ve only seen it from above.', 'thinking']] },
  { at: 'glowforest', tells: 'geovalley', lines: [['aroha', 'Feel that warm wind? Beyond here the ground boils. Te Riu Wera. Step only where I step.', 'serious']] },
  { at: 'geovalley', tells: 'unknown', lines: [['aroha', 'Past the old stair... no. We don’t talk about that place. The old people called it the Throat.', 'worried']] },
  { at: 'isle-cave', tells: 'grotto', lines: [['aroha', 'This pool goes deeper than it looks. My cousins dare each other to swim through. Nobody has, yet.', 'teasing']] },
];

// ------------------------------------------------------------------ drawing and running them
/** start the events for this visit (called once by the expedition runtime when a scene opens) */
export function startEvents(r: TripRun) {
  const s = S(), day = dayNumber();
  const ok = EVENTS.filter(e => {
    if (e.once && s.n[e.id]) return false;
    if (e.every !== undefined && s.last[e.id] !== undefined && day - s.last[e.id] < e.every) return false;
    try { return e.fits(r); } catch { return false; }
  });
  const picks: TripEvent[] = [];
  // nightfall always comes first when it fits; otherwise one or two at random
  const night = ok.find(e => e.id === 'nightfall');
  if (night) picks.push(night);
  const n = rand.chance(0.45) ? 2 : 1;
  const pool = ok.filter(e => e !== night);
  while (picks.length < n + (night ? 1 : 0) && pool.length) {
    const tot = pool.reduce((a, e) => a + e.w, 0);
    let k = rand.next() * tot, i = 0;
    for (; i < pool.length - 1; i++) { k -= pool[i].w; if (k <= 0) break; }
    picks.push(pool.splice(i, 1)[0]);
  }
  let delay = rand.range(18, 35);
  for (const e of picks) {
    const at = delay;
    delay += rand.range(35, 70);
    let t = 0, fired = false;
    r.tickers.push(dt => {
      if (fired) return;
      t += dt;
      if (t < at || !free(r)) return;
      fired = true;
      s.last[e.id] = day;
      s.n[e.id] = (s.n[e.id] ?? 0) + 1;
      s.log.push({ day, id: e.id, loc: r.loc });
      if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
      game.persist();
      Promise.resolve(e.run(r)).catch(err => console.warn('event', e.id, err));
    });
  }
}
/** what happened on recent trips (the camp's day report can read it) */
export const eventLog = () => S().log;
void add; void discover; void sleep;
