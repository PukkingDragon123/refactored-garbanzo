// V12 fourteen more side quests, each built on a different thing to DO (none of them fetch-and-hand-in),
// for the long middle and late game. They live in the ordinary quest book (src/game/quests.ts: the HUD
// note and the notebook track them, the steps tick themselves). The givers:
//
//   Te Kāinga (offered in floating dialogue through the village's talk hook, people.ts SIDE_HOOKS)
//     sq2_golden    Uncle Hēmi    Golden Hour: three species in one dusk, each two stars or better;
//                                 show him; hold the pāua steady while he cuts it; the inlay next day
//     sq2_night     Koro          Night Shift: five different night behaviours; then the ruru, calling;
//                                 then sit with him by the fire after dark and tell him what you saw
//     sq2_piglet    Manu          The Runaway Piglet II: Taewa in the market lane: herd him west to
//                                 the pen (walk at him, don't run); coax him out of the Lees' store;
//                                 mend the pen rope
//     sq2_cookoff   Nanny Huia    The Cook-off: a fish and something starchy; cook against her at the
//                                 evening fire (only perfect wins; good is a tie); tell Koro
//     sq2_guitar    Aunty Hana    Guitar Night: learn Te Rere o te Manu at the fire; play it for Koro
//                                 at the pou at dawn, near perfect; tell Hana
//     sq2_eel       Rāwiri        Eel Elder: feed the old tuna in the backcountry creek on three
//                                 different days; photograph her at night; show Koro; tell Rāwiri
//     sq2_kumara2   Tamati        Kūmara Night: possums in the gardens after dark: drive six off with
//                                 the sling before they strip three mounds; spare the mother and joey;
//                                 lash a flax fence with him
//     sq2_kereru    Pīpī          Stuck Kererū: find it tangled in supplejack in Fernwood; climb up
//                                 (the climbing rope); ease it free; catch it as it tumbles (it's drunk
//                                 on miro berries); tell Pīpī
//   Big Hank (the NPC conversation menu, src/game/v11/npcs)
//     sq2_shipment  Hank          Hank's Shipment: Lily wrote back, and the letter is in a crate at
//                                 Dutch Vos's camp in the kānuka scrub: sneak past his lantern at night
//                                 (stay out of the light, or low in cover), ease it out, bring it back
//   Hine at Te Puni station
//     sq2_tramper   Hine          The Lost Tramper: Doug went up Te Tuawhenua after "the crested one":
//                                 his flagging tape, his prints into the river, his note on the burnt
//                                 ridge, Doug himself in the feathered gully; splint his ankle; tell Hine
//   The camp board (src/game/v10/campquests.ts)
//     sq2_eye       Jenna         Eye to Eye: a predator looking right down the lens, close and big;
//                                 then get home in one piece
//     sq2_kea       Joshu         Kea Heist: play his harmonica to the kea on the burnt ridge; one
//                                 steals it; chase it from perch to perch before it gets to its nest
//                                 (or go into the nest after it); hand it back
//     sq2_dark      field office  Darkroom Master: a four-star photograph; a perfect print in Jenna's
//                                 red-lamp tent; hand it in for the exhibition
//     sq2_lure      Aroha         The Light in the Canopy: after dark on the high branches, wait for
//                                 the lure-viper's little light; photograph it luring; scare off the
//                                 sail possum creeping toward the lure before it strikes
//
// When each one finishes, game.save.vars['side:done'] goes up by one (flag sq2:counted:<id>). State:
// flags and vars 'sq2:*' and the bucket 'sq2'.

import { game } from '../game';
import type { FieldScene } from '../scenes/field';
import type { Actor } from '../../world/actor';
import type { Interactable } from '../../world/npc';
import type { BubbleLine } from '../../ui/bubbles';
import type { RawPhoto } from '../photos';
import type { Animal } from '../wild/animal';
import type { TripRun } from '../v10/field10';
import type { VCtx } from '../v11/village/ctx';
import type { NpcQuest } from '../v11/npcs/quests';
import type { Renderer } from '../../gfx/renderer';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../quests';
import type { QuestDef, QuestStep, Giver } from '../quests';
import { REQUESTS, REQ_BY_ID } from '../v10/campquests';
import type { Req } from '../v10/campquests';
import { NPC_QUESTS, NPC_QUEST_BY_ID } from '../v11/npcs/quests';
import { L } from '../v11/npcs/types';
import { ITEMS, defineItem } from '../items';
import { count, give, remove, stacks } from '../inventory';
import { judgeSubject } from '../photos';
import { SPECIES_BY_ID } from '../species';
import { dayNumber } from '../v10/day';
import { onLocEnter } from '../v10/field10';
import { CAMP_X } from '../v10/expedition';
import { addNote } from '../v10/regions';
import { bucket } from '../v10/store';
import { tr } from '../v10/translator';
import { INGREDIENTS } from '../v11/cooking';
import { addAffinity, hasMet } from '../v11/social';
import { PREDATORS, onPredator } from '../v11/predators-core';
import { say as vsay } from '../v11/village/ctx';
import { X } from '../v11/village/layout';
import { Livestock } from '../v11/village/livestock';
import type { Animal11 } from '../v11/village/livestock';
import { Custom, Prop } from '../../world/props';
import { packColor, WHITE } from '../../gfx/renderer';
import { PixelBuffer } from '../../art/pixel';
import { hex } from '../../art/color';
import { registerItemArt } from '../../art/v11/itemart';
import { sprite } from '../sites2/common';
import { findArt } from '../v10/finds';
import { A } from '../assets';
import { audio } from '../../core/audio';
import { rand, clamp } from '../../core/math';
import { floatText, floatNotice } from '../../ui/v12/float';
import { cineShake } from '../v11/cine';
import { hitMori, moriHidden } from './wilds';
import { qte } from './qte';
import { gateOk, GATES } from './gear';
import { tuaHooks } from './backcountry/hooks';
import { TUA, tuaGround } from './backcountry/gen';
import { KEA_ID, spawnKea } from './wild/birds';
import { TUNA_CTX } from './wild/crawlers';
import { WILD } from './wild/encounters';

// ================================================================== state and helpers
const F = (k: string) => !!game.save.flags['sq2:' + k];
const setF = (k: string, v = true) => { game.save.flags['sq2:' + k] = v; game.persist(); };
const V = (k: string) => game.save.vars['sq2:' + k] ?? 0;
const setV = (k: string, n: number) => { game.save.vars['sq2:' + k] = n; game.persist(); };
const GF = (k: string) => !!game.save.flags[k];
const st = (id: string) => questStatus(id);
const active = (id: string) => st(id) === 'active';
const done = (id: string) => st(id) === 'done';
const today = () => dayNumber();
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const live = (f: FieldScene) => game.scene === (f as never);
const refresh = () => (game.scene as unknown as { hud?: { refresh(f?: boolean): void } } | null)?.hud?.refresh(true);
const safe = (fn: () => boolean) => { try { return fn(); } catch { return false; } };
const songBest = (id: string) => game.save.vars['v12g:best:' + id] ?? 0;
const metV = (id: string) => GF('v11v:met:' + id);
const hasTool = (id: string) => game.save.tools.includes(id);
const prog = (n: number, of: number): [number, number] => [Math.min(of, Math.max(0, n)), of];
const night = (f: FieldScene) => f.tod === 'night';
const evening = (f: FieldScene) => f.tod === 'dusk' || f.tod === 'night';

interface SQ2State { gold: { day: number; sp: string[] }; nightBeh: string[]; eelDays: number[] }
const S = () => bucket<SQ2State>('sq2', () => ({ gold: { day: 0, sp: [] }, nightBeh: [], eelDays: [] }));
const goldToday = () => { const g = S().gold; return g.day === today() ? g.sp.length : 0; };

type Style = 'say' | 'shout' | 'whisper' | 'scared' | 'happy' | 'laugh' | 'sad' | 'think';
const mori = (text: string, style: Style = 'say', ms = 2600) => floatText({ text, style, ms });
/** a villager (through the translator) or anyone with a speaker in the scene, as a floating bark */
function bark(who: string, text: string, expr = 'neutral') {
  const ENGLISH = new Set(['mori', 'jenna', 'joshu', 'hank', 'hine', 'doug', 'teo', 'aroha']);
  const t = ENGLISH.has(who) ? text : tr(text).text;
  try { game.ui.bubbles.bark(who, t, { expr } as never); } catch { void floatText({ text: t, ms: 2600 }); }
}
function addRP(n: number) { const s = game.save; s.rp += n; s.totalRp += n; game.persist(); }
const think = (text: string, choices: string[]): BubbleLine => ({ who: 'mori', text, style: 'think', choices });

/** an interaction in a scene (busy-guarded: a cutscene while it runs) */
function spot(f: FieldScene, o: { x: number | (() => number); y: number | (() => number); w?: number; h?: number; label: string | (() => string); when: () => boolean; quest?: () => boolean; act: () => Promise<void>; stand?: boolean }) {
  const gx = typeof o.x === 'number' ? () => o.x as number : o.x, gy = typeof o.y === 'number' ? () => o.y as number : o.y;
  const lab = typeof o.label === 'string' ? () => o.label as string : o.label;
  (f.interact as Interactable[]).push({
    get x() { return gx(); }, get y() { return gy(); }, w: o.w ?? 16, h: o.h ?? 18,
    get standX() { return o.stand === false ? undefined : gx() + (f.player.x < gx() ? -16 : 16); },
    get label() { return lab(); },
    enabled: () => safe(o.when),
    quest: o.quest ?? (() => true),
    action: async () => {
      if (f.cutscene || game.ui.bubbles.active) return;
      f.cutscene = true;
      try { await o.act(); } catch (e) { console.error('[sq2]', e); } finally { f.cutscene = false; refresh(); }
    },
  } as Interactable);
}
/** a painted prop that is only there when `when` says so */
function propWhen(f: FieldScene, key: string, gen: () => { buf: PixelBuffer; ax: number; ay: number } | null, x: number, y: number, z: number, when: () => boolean, glint = false) {
  const c = sprite(key, gen);
  if (!c) return;
  const p = new Prop(c.f, x, y, z, { foliage: false });
  f.main.add(new Custom(z, (rr, s) => {
    if (!safe(when)) return;
    p.draw(rr, s);
    if (glint) { const k = Math.max(0, Math.sin(s.time * 2.1 + x) - 0.55) / 0.45; if (k > 0) rr.fxDraw(A.spark, x + Math.sin(s.time) * 2, y - 8, 0.6, 0.6, s.time, packColor(1, 0.95, 0.75, 1), 1.3 * k); }
  }));
}
/** a little hand-placed pixel map (rows of palette keys; '.' is clear) */
function pmap(rows: string[], pal: Record<string, string>): PixelBuffer {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const b = new PixelBuffer(w, h);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) b.set(x, y, hex(c)); } });
  return b;
}
/** an item icon: the map centred in a 24 px Backpack cell, a hard 1 px drop shadow */
function icon(rows: string[], pal: Record<string, string>): () => HTMLCanvasElement {
  return () => {
    const src = pmap(rows, pal);
    const b = new PixelBuffer(24, 24);
    const ox = Math.floor((24 - src.w) / 2), oy = Math.floor((24 - src.h) / 2);
    const SH = hex('#100608', 0x60);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) if (src.get(x, y) >>> 24) b.set(ox + x + 1, oy + y + 1, SH);
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) { const c = src.get(x, y); if (c >>> 24) b.set(ox + x, oy + y, c); }
    return b.toCanvas(1);
  };
}

// ================================================================== things
const OUT = '#140a10';
const HARMONICA = [
  '.oooooooooooooooo.',
  'oyssssssssssssssmo',
  'osmmmmmmmmmmmmmmdo',
  'owhwhwhwhwhwhwhwwo',
  'owhwhwhwhwhwhwhwwo',
  'oxwwwwwwwwwwwwwwxo',
  'osmmmmmmmmmmmmmmdo',
  'omdddddddddddddddo',
  '.oooooooooooooooo.',
];
const LETTER = [
  'oooooooooooooooo',
  'oyppppppppppbbbo',
  'oqpppppppppbrwbo',
  'oppqpppppppbwrbo',
  'opppqqppppqbbbbo',
  'oppppqqppqqppppo',
  'opppppqqqqpppppo',
  'oplllllppppppppo',
  'oppppppppppkpkpo',
  'opllllllllppkkpo',
  'oqqqqqqqqqqqkqqo',
  'oooooooooooooooo',
];
const PRINT = [
  'oooooooooooooooo',
  'owwwwwwwwwwwwwwo',
  'owssssssssssssmo',
  'owsssssssnsssswo',
  'owssssssnnnssswo',
  'owssssssssnssswo',
  'owsggggssssssswo',
  'owgGGggggsssgg.o',
  'owGGggGGgggggGwo',
  'owGGGGGGGGGGGGwo',
  'owwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwo',
  'oooooooooooooooo',
];
function defs() {
  const item = (id: string, name: string, desc: string, o: { weight?: number; where?: string } = {}) => {
    if (!ITEMS[id]) defineItem({ id, name, kind: 'key', stack: 1, desc, weight: o.weight ?? 0.2, where: o.where });
  };
  item('sq2_harmonica', 'Joshu’s harmonica', 'A Hohner in a key nobody can name, the chrome worn through to brass where his thumbs go. "Kea love a tune," his old bosun swore.');
  item('sq2_letter', 'Lily’s letter', 'A purple envelope from Dayton, Ohio, with a rattlesnake sticker on the flap. "To the friend who takes pictures. c/o Hank."', { where: 'In a crate at Dutch Vos’s camp' });
  item('sq2_print', 'Exhibition print', 'Your best photograph, developed by the red lamp in Jenna’s tent: clean whites, deep blacks, not a blotch on it.', { where: 'Developed at camp' });
  registerItemArt('sq2_harmonica', icon(HARMONICA, { o: OUT, y: '#ffffff', s: '#d8dde2', m: '#9aa3ab', d: '#5e666e', w: '#b07a34', h: '#1a1210', x: '#7a5020' }));
  registerItemArt('sq2_letter', icon(LETTER, { o: OUT, y: '#fff8e4', p: '#efe4c4', q: '#c8b48a', l: '#5a4a8a', b: '#2a5a9a', r: '#c8341e', w: '#f2f2ea', k: '#e0407a' }));
  registerItemArt('sq2_print', icon(PRINT, { o: OUT, w: '#f2ecdc', s: '#9ac0d8', m: '#7aa0c0', n: '#2a2018', g: '#5a8a3a', G: '#2e5a26' }));
}

// ================================================================== the quests
const step = (text: string, k: string, hint?: string): QuestStep => ({ text, done: () => F(k), hint });
interface VQ {
  def: QuestDef;
  giver: string;
  unlock: () => boolean;
  ask: BubbleLine[];
  yes: BubbleLine[];
  no: BubbleLine;
  onAccept?: () => void;
}
const q = (id: string, title: string, giver: string, desc: string, steps: QuestStep[], rp: number, text: string): QuestDef => ({ id, title, giver: giver as Giver, main: false, desc, steps, reward: { rp, text } });

// ---------------------------------------------------------------- Te Kāinga
const VQS: VQ[] = [
  {
    giver: 'hemi', unlock: () => done('v12_prow'),
    def: q('sq2_golden', 'Golden Hour', 'hemi', 'The prow is carved; now the inlay. Uncle Hēmi wants pāua along the wings that shines like the hour before dark, and he has never once been out of the shed at that hour to look. He wants it brought to him.', [
      { text: 'Photograph 3 different species in one dusk (2 stars or better each)', done: () => F('gold:shot'), progress: () => prog(F('gold:shot') ? 3 : goldToday(), 3), hint: 'Dusk only, the golden hour, all three on the same evening. Anywhere: the river flats, the canopy, the lane. Sharp, close and well framed.' },
      step('Show Uncle Hēmi the golden-hour pictures', 'gold:shown', 'He’s in the carving shed by day.'),
      step('Hold the pāua steady while he cuts it', 'gold:set', 'In the shed. Hold still, let go when he says.'),
      { text: 'Come back the next day for the inlay', done: () => F('gold:done'), hint: 'Glue takes a night. Hēmi says so do carvers.' },
    ], 45, 'The pāua on the prow shines like five o’clock.'),
    ask: [
      { who: 'hemi', text: 'The prow’s done. Now the eyes and the wing edges: pāua. But under the shed roof pāua looks like dishwater.', expr: 'grumpy' },
      { who: 'hemi', text: 'The old carvers matched it to the hour before dark. The gold hour. I’ve been in this shed at that hour for thirty years.', expr: 'thinking' },
      { who: 'hemi', text: 'Bring me that hour. Three different creatures, all in one evening, all sharp. I’ll cut the shell to them.', expr: 'serious' },
    ],
    yes: [{ who: 'hemi', text: 'One evening, mind. Light changes every day. Like wood.', expr: 'neutral' }],
    no: { who: 'hemi', text: 'Hm. The shell will wait. It’s waited a million years.', expr: 'neutral' },
  },
  {
    giver: 'koro', unlock: () => metV('koro') && today() >= 4,
    def: q('sq2_night', 'Night Shift', 'koro', 'Koro says the day talks over itself, and the night only whispers. He wants to hear the whisper: five things the night animals do that nobody sees by day.', [
      { text: 'Photograph 5 different night behaviours', done: () => F('night:five'), progress: () => prog(F('night:five') ? 5 : S().nightBeh.length, 5), hint: 'After dark. Five different animals or doings: feeding, calling, hunting, grooming... Each must be sharp enough to name.' },
      step('Koro wants one more: a ruru calling in the dark', 'night:ruru', 'The old rimu in Te Tuawhenua has a ruru in its hollow. After dusk it hunts from a low branch and calls "more-pork".'),
      step('Sit with Koro by the fire after dark and tell him', 'night:told', 'He sits on the paepae by day and at the marae fire after dark.'),
    ], 55, 'Koro knows the night’s whisper again.'),
    ask: [
      { who: 'koro', text: 'E tama. You photograph the day. Everybody photographs the day. The day shouts.', expr: 'neutral' },
      { who: 'koro', text: 'The night whispers. My eyes are too old for the whisper now. Bring me five things the night does, that the day never sees.', expr: 'serious' },
    ],
    yes: [{ who: 'koro', text: 'Go soft. Go slow. The night hears your boots before it sees your face.', expr: 'happy' }],
    no: { who: 'koro', text: 'The night will still be there. It always is.', expr: 'neutral' },
  },
  {
    giver: 'manu', unlock: () => done('v12_taewa'),
    def: q('sq2_piglet', 'The Runaway Piglet II', 'manu', 'Taewa is out again. This time he went the other way: into Te Huarahi, the market lane, where there are cabbages, and stalls, and people with brooms.', [
      step('Find Taewa in Te Huarahi, the market lane', 'pig2:found', 'East of the goats, all the way down the lane toward Hank’s.'),
      step('Coax him out of the Lees’ store', 'pig2:out', 'He’ll dart in where the smells are. A kūmara helps. So does being quick.'),
      { text: 'Herd him west, back to the pen', done: () => F('pig2:home'), progress: () => prog(F('pig2:home') ? 100 : V('pig2:pct'), 100), hint: 'Walk at him from the east and he trots away from you. Don’t run: run and he bolts, any which way.' },
      step('Mend the pen rope with Manu', 'pig2:done', 'Manu is by the pen.'),
    ], 30, 'Taewa is home. The rope is now a chain. Taewa is already looking at the chain.'),
    ask: [
      { who: 'manu', text: 'Okay. Don’t laugh. He’s out again.', expr: 'sad' },
      { who: 'manu', text: 'This time he went down Te Huarahi. Mrs Lee says he ate a cabbage. A WHOLE cabbage. She has a broom.', expr: 'worried' },
      { who: 'manu', text: 'Don’t carry him, he hates it, he screams like a kettle. You have to walk him home. Slowly. Like a sheepdog.', expr: 'serious' },
    ],
    yes: [{ who: 'manu', text: 'Thanks, bro. Walk at his bum. Never at his face. Trust me.', expr: 'happy' }],
    no: { who: 'manu', text: 'Yeah... Mrs Lee’s broom will probably get him first.', expr: 'sad' },
  },
  {
    giver: 'huia', unlock: () => done('v12_stones'),
    def: q('sq2_cookoff', 'The Cook-off', 'huia', 'Nanny Huia has cooked for Te Kāinga for fifty years and nobody has ever beaten her. She would like that to change, she says. She is lying.', [
      { text: 'Bring a fish and something starchy for the cook-off', done: () => F('cook:won') || (hasTag('fish') && hasTag('starch')), hint: 'Rāwiri always has fish; kūmara from Tamati’s gardens; ship biscuits count as starch.' },
      step('Beat Nanny Huia at the cooking fire one evening', 'cook:won', 'Talk to her by her cooking fire at dusk or after dark. Only a perfect dish beats her. A good one is a tie.'),
      step('Tell Koro you beat his sister', 'cook:koro', 'He’ll want to hear it. He’s waited seventy years.'),
    ], 40, 'Nanny Huia’s flax crown, and the respect of the whole marae.'),
    ask: [
      { who: 'huia', text: 'You. Skinny one. You cook, don’t you? Out there with your little pot?', expr: 'teasing' },
      { who: 'huia', text: 'A cook-off. You and me, at my fire, one evening. The kids judge. Bring a fish and something to fill a belly.', expr: 'smug' },
    ],
    yes: [{ who: 'huia', text: 'Ha! Brave. Stupid, but brave. I like that in a grandson.', expr: 'laugh' }],
    no: { who: 'huia', text: 'Scared. Good. You should be.', expr: 'smug' },
  },
  {
    giver: 'hana', unlock: () => done('v12_guitar'),
    def: q('sq2_guitar', 'Guitar Night', 'hana', 'Aunty Hana’s hardest song, Te Rere o te Manu, The Kite’s Flight. Her father wrote it for a dawn, and she says it has only ever been played right at one.', [
      { text: 'Learn “Te Rere o te Manu” with Aunty Hana at the evening fire', done: () => F('gtr:dawn') || songBest('manu') >= 60, hint: 'In the evening at the marae fire, talk to Hana and pick it from her songs. Sixty out of a hundred or better.' },
      step('Play it for Koro at the pou at dawn, near perfect', 'gtr:dawn', 'At dawn, Koro makes the offering at the pou by the landing. 85 out of 100 or better.'),
      step('Tell Aunty Hana', 'gtr:done', 'She plays on her bench by day.'),
    ], 45, 'A dawn song, played right, for the man it was written for.'),
    ask: [
      { who: 'hana', text: 'You’ve got Te Ahi. You’ve got Hoki Mai. There’s one more, and it’s a horrible one.', expr: 'teasing' },
      { who: 'hana', text: 'Te Rere o te Manu. Dad wrote it for a dawn. For Koro, actually. Koro’s never heard it played right.', expr: 'serious' },
    ],
    yes: [{ who: 'hana', text: 'Learn it at the fire with me. Then play it for him when the sun comes up. No pressure. All the pressure.', expr: 'laugh' }],
    no: { who: 'hana', text: 'Sensible. It’s eaten better fingers than yours.', expr: 'neutral' },
  },
  {
    giver: 'rawiri', unlock: () => metV('rawiri') && (GF('wild:tunaSeen') || GF('visit:backcountry')),
    def: q('sq2_eel', 'Eel Elder', 'rawiri', 'Rāwiri’s koro fed an old tuna in a deep pool up the backcountry creek, and called her Kui. If she is still alive she is older than anyone in the village. Rāwiri wants her to know a friend again.', [
      { text: 'Feed the old tuna in the deep creek pool on three different days', done: () => F('eel:fed3'), progress: () => prog(F('eel:fed3') ? 3 : S().eelDays.length, 3), hint: 'The deep pool under the bank in Te Tuawhenua’s creek bed. Drop a huhu grub in (they live under rotten logs). Once a day, three days.' },
      step('Photograph her at night', 'eel:photo', 'After dark she comes right up to the surface for the grub. Have the camera ready.'),
      step('Show Koro the photograph', 'eel:koro', 'Koro knew Rāwiri’s koro. He’ll know her.'),
      step('Tell Rāwiri', 'eel:done', 'At the landing, or the smoking rack.'),
    ], 55, 'Kui has a friend again. Nobody will set a hīnaki in her pool.'),
    ask: [
      { who: 'rawiri', text: 'You’ve been up the backcountry creek? There’s a deep pool under a bank. My koro used to feed a tuna there. Kui, he called her.', expr: 'thinking' },
      { who: 'rawiri', text: 'He said she was older than him. If she’s still there... feed her. Three days, so she knows you. Then get her picture, at night. For me.', expr: 'serious' },
    ],
    yes: [{ who: 'rawiri', text: 'Huhu grubs. She can’t say no to a huhu. Nobody can.', expr: 'happy' }],
    no: { who: 'rawiri', text: 'All good. She’s waited this long.', expr: 'neutral' },
  },
  {
    giver: 'tamati', unlock: () => done('v12_kumara') && hasTool('slingshot'),
    def: q('sq2_kumara2', 'Kūmara Night', 'tamati', 'The anuhe are gone and the kūmara are fat, and now the possums have found them. They come out of the bush after dark and dig. Tamati needs a good shot.', [
      step('Be in Tamati’s gardens after dark', 'kn:start', 'The gardens at the west end of the village. After dark. Bring the sling.'),
      { text: 'Drive six possums off the kūmara with the sling', done: () => F('kn:won'), progress: () => prog(F('kn:won') ? 6 : V('kn:hits'), 6), hint: 'G readies the sling. Hit them before they reach the mounds: three mounds dug and the night is lost (try again the next night).' },
      step('Spare the mother and her joey, and lash a flax fence with Tamati', 'kn:fence', 'In the gardens, with Tamati.'),
    ], 45, 'A flax fence round the mounds, and a possum family that eats somewhere else.'),
    ask: [
      { who: 'tamati', text: 'Bro. The kūmara are beautiful. Fat as babies. And something is digging them up every night.', expr: 'grumpy' },
      { who: 'tamati', text: 'Possums. They come out of the bush when it’s dark. You’ve got that sling. Sting them, don’t kill them. Just make them think again.', expr: 'serious' },
    ],
    yes: [{ who: 'tamati', text: 'After dark, in the gardens. I’ll bring a torch. You bring your eye.', expr: 'happy' }],
    no: { who: 'tamati', text: 'Then I’ll sit up with a pot and a spoon. Again.', expr: 'tired' },
  },
  {
    giver: 'pipi', unlock: () => metV('pipi') && today() >= 3,
    def: q('sq2_kereru', 'Stuck Kererū', 'pipi', 'Pīpī saw a kererū, a fat wood pigeon, tangled up a tree in Fernwood on the walk to the stream. It is going "hoo". A sad hoo.', [
      step('Find the tangled kererū in Fernwood', 'ker:found', 'On the way to the stream in Fernwood, high up in the supplejack.'),
      step('Climb up to it', 'ker:up', 'It’s a long way up. You’ll need a climbing rope.'),
      step('Ease it out of the supplejack', 'ker:free', 'Gently. The vine is wound round a wing.'),
      step('Catch it when it falls: it’s drunk on miro berries', 'ker:caught', 'It tumbles like a sack of potatoes. Get under it.'),
      step('Tell Pīpī', 'ker:done', 'She runs about the village all day.'),
    ], 35, 'One kererū, sobered up, and one very proud Pīpī.'),
    ask: [
      { who: 'pipi', text: 'MORI. Mori Mori Mori. There’s a kererū stuck up a tree in the forest! It’s all tangled!', expr: 'excited' },
      { who: 'pipi', text: 'We saw it on the walk to the stream. It went "hoo". A SAD hoo. You have to save it. You have to!', expr: 'worried' },
    ],
    yes: [{ who: 'pipi', text: 'YES! I knew you would! It’s green and white and FAT. You can’t miss it.', expr: 'excited' }],
    no: { who: 'pipi', text: 'But it’s SAD...', expr: 'sad' },
  },
];
const VQ_BY: Record<string, VQ> = Object.fromEntries(VQS.map(v => [v.def.id, v]));
const declined: Record<string, number> = {};
const offerable = (v: VQ) => st(v.def.id) === 'hidden' && declined[v.def.id] !== today() && safe(v.unlock);

// ---------------------------------------------------------------- the camp board
const board = (r: Req): Req => r;
const REQS: Req[] = [
  board({
    id: 'sq2_eye', giver: 'jenna', title: 'Eye to Eye', unlock: () => today() >= 4,
    desc: 'Jenna wants the scariest photograph in the world for the tent wall: something that could eat you, looking straight down the lens, so close you can count its eyelashes. Then she wants you home in one piece.',
    steps: [
      { text: 'Photograph a predator looking right down the lens, close and big in frame', done: () => F('eye:shot'), hint: 'Anything with teeth that hunts. Facing you, filling half the frame or more, three stars. Have an escape plan.' },
      step('Get home to camp in one piece', 'eye:home', 'Walk back into camp. Preferably with both legs.'),
    ],
    reward: { rp: 60, text: 'Jenna’s tent wall now has a pair of eyes that follow you round the room.' },
    ask: 'Mori. Idea. A photo of something that could EAT you. Looking at the camera. Close enough I can see what it had for breakfast. For my wall. Then come home. Both parts are important.',
    thanks: 'AAAH. Its EYES. It’s looking at ME. ...Perfect. Going on the wall. You’re never doing that again.',
  }),
  board({
    id: 'sq2_kea', giver: 'joshu', title: 'Kea Heist', unlock: () => GF('visit:backcountry'),
    desc: 'Joshu’s old bosun swore that kea love music. Joshu has wanted to know for forty years. He lends you his harmonica to play to the kea on the burnt ridge. He is very attached to that harmonica.',
    steps: [
      step('Play Joshu’s harmonica to the kea on the burnt ridge', 'kea:stolen', 'Te Hiwi Pango, the burnt ridge in Te Tuawhenua. Stand near the kea and play.'),
      { text: 'Get the harmonica back before the kea reaches its nest', done: () => F('kea:back'), hint: 'Sprint to close the gap, walk the last bit, and grab it while it plays. If it gets home to its nest, you’ll have to reach in after it.' },
    ],
    give: [['sq2_harmonica', 1]],
    reward: { rp: 50, bond: 8, text: 'Joshu’s harmonica, a bit chewed. The kea, it turns out, LOVE music. Mostly they love stealing it.' },
    ask: 'Here, lad. My harmonica. Old bosun swore kea dance to a tune. Forty years I’ve wondered. Go play it to them on the burnt ridge. And bring it BACK.',
    thanks: 'Teeth marks. TEETH MARKS. ...Ha! So they do love music. Just not the way the bosun meant.',
  }),
  board({
    id: 'sq2_dark', giver: 'agency', title: 'Darkroom Master', unlock: () => GF('v10:agency') && today() >= 5,
    desc: 'The field office is putting on an exhibition in Wellington and wants one real silver print: your best picture, developed by hand, perfectly. No blotches, no mud, no pale ghosts.',
    steps: [
      step('Take a four-star photograph', 'dark:shot', 'Close, sharp, facing you, doing something, well framed. Four stars on the print.'),
      { text: 'Develop a perfect exhibition print in Jenna’s red-lamp tent at camp', done: () => F('dark:print'), hint: 'The tent by the research table. Rock the tray evenly, lift it out when the blacks are black and the whites still clean. Jenna has paper for two tries a day.' },
    ],
    give: [['sq2_print', 1]],
    reward: { rp: 70, text: 'Your print hangs in Wellington, between two people who went to art school.' },
    ask: 'Exhibition request: one hand-developed print of your finest photograph. Perfectly developed, please. The curator is particular. The curator is my mother.',
    thanks: 'The print arrived. The curator cried. The curator says you may call her Margaret.',
  }),
  board({
    id: 'sq2_lure', giver: 'aroha', title: 'The Light in the Canopy', unlock: () => GF('visit:canopy') || gateOk('gloves'),
    desc: 'Koro says that up in the Emerald Canopy, after dark, a little light walks along the branches by itself. The birds that follow it don’t come back. Aroha wants to see it, and to know what it is.',
    steps: [
      step('After dark on the canopy’s high branches, wait for the little light', 'lure:seen', 'Up the kauri into the Emerald Canopy, after dusk. Get on the high branches, crouch, and wait. Don’t chase it.'),
      step('Photograph the lure-viper luring', 'lure:photo', 'The light is the tip of its tail. Shoot while it dangles it.'),
      { text: 'Scare off what comes for the light before the viper strikes', done: () => F('lure:saved') || F('lure:late'), hint: 'Something small is coming to the light. Be quick.' },
    ],
    reward: { rp: 60, bond: 10, text: 'Aroha now knows what the little light is. She says she liked it better as a story.' },
    ask: 'Koro says in the canopy, after dark, a little light walks along the branches by itself. Birds follow it and don’t come back. Will you go and see what it is? I want to know. I think.',
    thanks: 'A SNAKE. With a lamp on its TAIL. ...And you saved the possum? Of course you did. Koro is going to love this.',
  }),
];

// ---------------------------------------------------------------- Big Hank and Hine (the NPC menu)
const said = (h: { say(l: BubbleLine[]): Promise<number> }, c: [string, string, string?][]) => h.say(L(c));
const NQS: NpcQuest[] = [
  {
    id: 'sq2_shipment', giver: 'hank', title: 'Hank’s Shipment',
    desc: 'Lily wrote back. Her letter came in on the last crate, on Dutch Vos’s boat, and Vos (Hank’s old partner, and his new rival) is sitting on that crate at his camp in the backcountry scrub out of spite. Hank wants the letter. Quietly.',
    unlock: () => hasMet('hank') && done('q_lily'),
    ask: [
      ['hank', 'Psst. Kid. C’mere. Not a business thing. Okay, it’s a little bit a business thing.', 'worried'],
      ['hank', 'Lily wrote back. To the photo. She WROTE BACK. And the letter came in on Dutch Vos’s boat, in my crate.', 'serious'],
      ['hank', 'Vos and me, we had a falling out over a crate of flares. He’s camped in the scrub past the crossroads, sitting on my crate, out of spite. Sleeps with a lantern going.', 'grumpy'],
      ['hank', 'Get me that letter. After dark. Don’t let him see you. Vos throws things. Big things.', 'determined'],
    ],
    yes: [['hank', 'You’re a prince. Stay out of that lantern. Low and slow, like a guy sneaking out of a wedding.', 'happy']],
    steps: [
      step('Find Vos’s camp in the kānuka scrub, after dark', 'ship:found', 'Up past the crossroads behind the lane, into Te Tuawhenua, in the first stretch of scrub. After dark.'),
      { text: 'Sneak past his lantern and ease Lily’s letter out of the crate', done: () => F('ship:letter'), hint: 'Stay out of the light when it swings your way, or be low and still in cover. At the crate, hold your breath and go slow.' },
      step('Bring Lily’s letter to Hank', 'ship:given', 'His stall at the end of Te Huarahi.'),
    ],
    reward: { rp: 60, text: 'Lily’s letter, read out loud under a tarp in the dark. Hank says it’s the sun again.' },
    actions: () => (F('ship:letter') && !F('ship:given') && count('sq2_letter') > 0 ? [{ label: 'Lily’s letter. Straight out of Vos’s crate.', quest: true, run: async h => {
      remove('sq2_letter', 1);
      setF('ship:given');
      await said(h, [
        ['hank', 'You got it. You actually... gimme. Gimme gimme.', 'excited'],
        ['hank', '...Huh. It’s not to me.', 'surprised'],
        ['hank', '"To the friend who takes pictures." It’s to YOU, kid. You read it. My glasses are... I don’t have glasses. Read it.', 'sad'],
        ['mori', '"Dear friend who takes pictures. Thank you for the snake. I took it to school and Mr Pruitt said it was fake and I said it is NOT fake and I got detention and it was WORTH IT."', 'happy'],
        ['mori', '"Mum says the man who sends money every month might know you. If you see him, tell him the snake is on my wall. Tell him I am going to be a herpetologist. Love, Lily."', 'happy'],
        ['hank', '...', 'sad'],
        ['hank', 'Herpetologist. She can spell herpetologist. I can’t spell herpetologist.', 'happy'],
        ['hank', 'Sun’s real strong tonight. Through the sunglasses. In the dark. Don’t look at me.', 'sad'],
        ['hank', 'Kid. Anything you want off the shelf, it’s yours. And Vos? Vos can keep the flares.', 'determined'],
      ]);
      addAffinity('hank', 22, 'quest');
      floatNotice('Hank will never forget this', 3000);
      (h.f as unknown as { hud?: { refresh(force?: boolean): void } } | null)?.hud?.refresh(true);
    } }] : []),
  },
  {
    id: 'sq2_tramper', giver: 'hine', title: 'The Lost Tramper',
    desc: 'Doug went up into Te Tuawhenua three days ago after "the crested one", a bird he has chased for twenty-four years. He said two days. Doug is never late. Hine is pretending to be cross.',
    unlock: () => hasMet('hine') && done('q_roof') && today() >= 5,
    ask: [
      ['hine', 'Mori. Have you seen Doug? Three days ago he went up the backcountry after his crested bird. "Two days," he said.', 'worried'],
      ['hine', 'He’s never late. He’s never been late in thirty years. He’s late for NOTHING, not even the dentist.', 'grumpy'],
      ['hine', 'He ties yellow tape when he walks. Old habit. Follow the tape. Please.', 'sad'],
    ],
    yes: [['hine', 'Take water. And if he’s hurt, splint first, scold second. I’ll do the scolding.', 'serious']],
    steps: [
      step('Find Doug’s trail at the start of Te Tuawhenua', 'tramp:c1', 'Yellow flagging tape on a kānuka, in the scrub past the crossroads.'),
      step('Follow it across the braided river', 'tramp:c2', 'On the river flats. Look where his boots go into the water.'),
      step('Read what he left on the burnt ridge', 'tramp:c3', 'A cairn on the way up the burnt ridge.'),
      step('Find Doug in the feathered gully', 'tramp:found', 'In the ferns of the feathered gully. Listen for someone humming badly.'),
      step('Splint his ankle so he can walk out', 'tramp:splint', 'Talk to him. Steady hands.'),
      step('Tell Hine he’s safe', 'tramp:told', 'At Te Puni station on the bush track.'),
    ],
    reward: { rp: 70, text: 'Doug limps home the next morning with a stick and a story. The crested one remains uncrested.' },
    actions: () => (F('tramp:splint') && !F('tramp:told') ? [{ label: 'Doug’s safe. He’s walking out.', quest: true, run: async h => {
      setF('tramp:told');
      await said(h, [
        ['hine', 'Safe? He’s SAFE. ...Of course he is. Silly old fool. Of course he is.', 'happy'],
        ['mori', 'Twisted ankle. I splinted it. He’s limping home with a stick. He says he saw the crested one.', 'happy'],
        ['hine', 'He did not. He says that every time. ...Thank you, Mori. Really. Thirty years, and I don’t know what I’d do.', 'sad'],
        ['hine', 'Now go away before I get sentimental. Rangers don’t get sentimental. Rangers get things done.', 'grumpy'],
      ]);
      addAffinity('hine', 18, 'quest');
      addAffinity('doug', 14, 'quest');
      floatNotice('Te Puni station owes you one', 2800);
    } }] : []),
  },
];

// ================================================================== the village talk hook
async function offer(c: VCtx, v: VQ): Promise<boolean> {
  const k = await vsay(c.f, [...v.ask, think('Will you help?', ['I’ll help', 'Not right now'])]);
  if (k !== 0) { declined[v.def.id] = today(); await vsay(c.f, [v.no]); return false; }
  v.onAccept?.();
  startQuest(v.def.id);
  game.save.tracked = v.def.id;
  game.persist();
  if (v.yes.length) await vsay(c.f, v.yes);
  return true;
}
/** the step talks: who says what when a quest needs them now */
interface VStep { who: string; when: (c: VCtx) => boolean; run: (c: VCtx, a: Actor) => Promise<void>; mark?: boolean }
const VSTEPS: VStep[] = [
  // ---- Hēmi: the golden hour
  { who: 'hemi', when: () => active('sq2_golden') && F('gold:shot') && !F('gold:shown'), run: async c => {
    setF('gold:shown');
    await vsay(c.f, [
      { who: 'mori', text: 'Uncle. Three of them, one evening. Look at the light on that one.', expr: 'happy' },
      { who: 'hemi', text: '...So that’s what it looks like out there. Gold on the feathers. Gold on the fern. Gold on YOUR big nose, look.', expr: 'surprised' },
      { who: 'hemi', text: 'Right. Now I know the colour. Hold the shell for me. Still as a post.', expr: 'serious' },
    ]);
  } },
  { who: 'hemi', when: () => active('sq2_golden') && F('gold:shown') && !F('gold:set'), run: async c => {
    const r = await qte({ kind: 'hold', f: c.f, label: 'HOLD IT STEADY...', difficulty: 0.5 });
    if (!r.ok) { await vsay(c.f, [{ who: 'hemi', text: 'You wobbled. That’s a piece of shell gone to the sea. Again. Breathe out.', expr: 'grumpy' }]); return; }
    setF('gold:set');
    setV('gold:day', today());
    audio.play('craft' as never, { vol: 0.5 });
    await vsay(c.f, [{ who: 'hemi', text: 'Good. Good hands. Glue takes a night. Come back tomorrow and see.', expr: 'happy' }]);
  } },
  { who: 'hemi', when: () => active('sq2_golden') && F('gold:set') && !F('gold:done') && today() > V('gold:day'), run: async c => {
    setF('gold:done');
    await vsay(c.f, [
      { who: 'hemi', text: 'Look at her. The eyes catch the sun now. At five o’clock she’ll look like she’s on fire.', expr: 'happy' },
      { who: 'hemi', text: 'You gave her that. I’ll tell the river who did, when she goes in.', expr: 'serious' },
    ]);
    addAffinity('hemi', 14, 'quest');
  } },
  // ---- Koro: the night's whisper
  { who: 'koro', when: c => active('sq2_night') && F('night:five') && F('night:ruru') && !F('night:told') && night(c.f), run: async c => {
    setF('night:told');
    c.f.player.poseOverride = 'sitGround';
    await vsay(c.f, [
      { who: 'mori', text: 'Koro. I went out at night. Here: feeding, hunting, calling... and the ruru. It turned its head right round and looked at me.', expr: 'happy' },
      { who: 'koro', text: 'Ruru. Te kaitiaki o te pō: the watchman of the night. When I was small it lived in the tree behind this whare.', expr: 'happy' },
      { who: 'koro', text: 'It looked at you. That means it has a name for you now. Don’t ask what it is. It won’t be flattering.', expr: 'laugh' },
      { who: 'koro', text: 'Thank you, e tama. I heard the whisper again.', expr: 'neutral' },
    ], true);
    c.f.player.poseOverride = null;
    addAffinity('koro', 14, 'quest');
  } },
  { who: 'koro', mark: false, when: c => active('sq2_night') && F('night:five') && F('night:ruru') && !F('night:told') && !night(c.f) && V('night:nag') !== today(), run: async c => {
    setV('night:nag', today());
    await vsay(c.f, [{ who: 'koro', text: 'Not now. After dark, by the fire. Night things are for night.', expr: 'neutral' }]);
  } },
  { who: 'koro', when: () => active('sq2_night') && F('night:five') && !F('night:ruru') && !F('night:asked'), run: async c => {
    setF('night:asked');
    await vsay(c.f, [
      { who: 'koro', text: 'Five. Good. But you’ve missed the one that matters. The ruru. The watchman. Bring me the ruru, calling.', expr: 'serious' },
      { who: 'koro', text: 'There is an old rimu up the backcountry with a hollow in it. Knock, and say sorry for knocking.', expr: 'neutral' },
    ]);
  } },
  // ---- Koro: the eel and the cook-off (other people's quests)
  { who: 'koro', when: () => active('sq2_eel') && F('eel:photo') && !F('eel:koro'), run: async c => {
    setF('eel:koro');
    await vsay(c.f, [
      { who: 'koro', text: 'Show me. ...Āe. That’s Kui. See the notch on her fin? My father’s hīnaki did that, before the war. Sixty years ago.', expr: 'surprised' },
      { who: 'koro', text: 'Rāwiri’s koro made my father promise never to trap that pool again. And he never did. She remembers. Look at her looking at you.', expr: 'happy' },
    ], true);
  } },
  { who: 'koro', when: () => active('sq2_cookoff') && F('cook:won') && !F('cook:koro'), run: async c => {
    setF('cook:koro');
    await vsay(c.f, [
      { who: 'mori', text: 'Koro. I beat Nanny Huia. At cooking. The kids voted.', expr: 'happy' },
      { who: 'koro', text: '...You what? You BEAT her?', expr: 'surprised' },
      { who: 'koro', text: 'Seventy-four years. Seventy-four years I’ve waited for somebody to do that. Ha! HA! Huia! HUIA! Did you hear?', expr: 'laugh' },
      { who: 'huia', text: 'I can hear you, you old goat. The whole river can hear you.', expr: 'grumpy' },
    ]);
    addAffinity('koro', 6, 'quest');
  } },
  // ---- Huia: the cook-off
  { who: 'huia', when: c => active('sq2_cookoff') && !F('cook:won') && (cookReady(c.f) || V('cook:nag') !== today()), run: async c => {
    const f = c.f;
    if (!cookReady(f)) {
      setV('cook:nag', today());
      if (!evening(f)) await vsay(f, [{ who: 'huia', text: 'In the evening! When the fire’s right. The kids are no use as judges till they’re hungry.', expr: 'neutral' }]);
      else if (V('cook:day') === today()) await vsay(f, [{ who: 'huia', text: 'One cook-off a night. My heart can’t take two. Tomorrow.', expr: 'neutral' }]);
      else await vsay(f, [{ who: 'huia', text: 'Where’s your fish? Where’s your kūmara? You can’t cook air. Even I can’t cook air.', expr: 'teasing' }]);
      return;
    }
    await vsay(f, [
      { who: 'huia', text: 'Right. Pīpī, Ani, Mikaere: judges’ bench. No eating till you vote. MIKAERE.', expr: 'serious' },
      { who: 'huia', text: 'Your fire, your pot. I’ll be over here making something that’ll make you cry.', expr: 'smug' },
    ]);
    setV('cook:day', today());
    const { runCooking } = await import('../../ui/v11/cooking');
    const out = await runCooking({ where: 'field', coach: null, title: 'The cook-off: you against Nanny Huia' });
    const qual = out.result?.quality ?? null;
    if (qual === 'perfect') {
      setF('cook:won');
      await vsay(f, [
        { who: 'pipi', text: 'Mori’s! Mori’s is better! Sorry Nanny!', expr: 'excited' },
        { who: 'ani', text: 'Mori’s. It’s crispy AND soft.', expr: 'happy' },
        { who: 'mikaere', text: '*mouth full* MMNF.', expr: 'happy' },
        { who: 'huia', text: '...Well. Well well WELL. Fifty years. Come here.', expr: 'surprised' },
        { who: 'huia', text: 'A crown of flax for the cook who beat Huia. I plaited it in 1975 for this day. Go and tell my brother. He’ll be unbearable.', expr: 'happy' },
      ]);
      addAffinity('huia', 15, 'quest');
    } else if (qual === 'good') {
      await vsay(f, [
        { who: 'pipi', text: 'Mori’s!', expr: 'excited' },
        { who: 'ani', text: 'Nanny’s.', expr: 'neutral' },
        { who: 'mikaere', text: '...I ate both. Sorry. They were both so good.', expr: 'happy' },
        { who: 'huia', text: 'A tie! A TIE. Good isn’t good enough at my fire, boy. Another night. Perfect, or nothing.', expr: 'laugh' },
      ]);
    } else {
      await vsay(f, [
        { who: 'pipi', text: 'Um. Nanny’s.', expr: 'neutral' },
        { who: 'huia', text: 'Ha! Fifty years undefeated. Come back when you can cook, skinny one. Another night.', expr: 'laugh' },
      ]);
    }
  } },
  // ---- Hana: guitar night
  { who: 'hana', when: () => active('sq2_guitar') && F('gtr:dawn') && !F('gtr:done'), run: async c => {
    setF('gtr:done');
    await vsay(c.f, [
      { who: 'hana', text: 'Koro told me. Before I’d even got up. He came and sat on my step and told me.', expr: 'happy' },
      { who: 'hana', text: 'He said it was like Dad was playing. ...Thank you. Now get out of my sight before I cry on my good shirt.', expr: 'sad' },
    ]);
    addAffinity('hana', 15, 'quest');
    addAffinity('koro', 6, 'quest');
  } },
  // ---- Rāwiri: the eel elder
  { who: 'rawiri', when: () => active('sq2_eel') && F('eel:koro') && !F('eel:done'), run: async c => {
    setF('eel:done');
    await vsay(c.f, [
      { who: 'rawiri', text: 'Kui. Still there. With the notch in her fin, Koro says.', expr: 'happy' },
      { who: 'rawiri', text: 'Nobody sets a hīnaki in that pool. Not me, not anyone. I’ll tell the others. And you keep feeding her when you’re up there, eh? She knows you now.', expr: 'serious' },
    ]);
    addAffinity('rawiri', 15, 'quest');
  } },
  { who: 'rawiri', mark: false, when: () => active('sq2_eel') && F('eel:fed3') && !F('eel:photo') && !F('eel:nudge'), run: async c => {
    setF('eel:nudge');
    await vsay(c.f, [{ who: 'rawiri', text: 'Three days? She knows your shadow now. At night she’ll come right up. Get her picture then.', expr: 'happy' }]);
  } },
  // ---- Manu: the pen rope
  { who: 'manu', when: () => active('sq2_piglet') && F('pig2:home') && !F('pig2:done'), run: async c => {
    await vsay(c.f, [{ who: 'manu', text: 'You did it! Walked him home like a pro. Quick, help me with the rope before he figures out the gate. Pull when I say!', expr: 'excited' }]);
    const r = await qte({ kind: 'mash', f: c.f, x: X.pen[0] - 4, y: c.ground(X.pen[0]) - 30, label: 'TIE IT OFF!', difficulty: 0.45 });
    if (!r.ok) { await vsay(c.f, [{ who: 'manu', text: 'It slipped! He’s looking at it. He’s LOOKING at it. Again, quick!', expr: 'worried' }]); return; }
    setF('pig2:done');
    await vsay(c.f, [
      { who: 'manu', text: 'Double hitch. Chain next. Thanks, Mori. Mrs Lee says you owe her a cabbage, by the way.', expr: 'happy' },
    ]);
    addAffinity('manu', 14, 'quest');
  } },
  // ---- Tamati: the fence
  { who: 'tamati', when: () => active('sq2_kumara2') && F('kn:won') && !F('kn:fence'), run: async c => fence(c.f, c.ground) },
  // ---- Pīpī: the kererū
  { who: 'pipi', when: () => active('sq2_kereru') && F('ker:caught') && !F('ker:done'), run: async c => {
    setF('ker:done');
    await vsay(c.f, [
      { who: 'mori', text: 'Pīpī. Your kererū is fine. It was stuck. And also a tiny bit drunk. On berries.', expr: 'happy' },
      { who: 'pipi', text: 'DRUNK? Like Uncle Rāwiri at Christmas?', expr: 'surprised' },
      { who: 'rawiri', text: 'OI.', expr: 'grumpy' },
      { who: 'pipi', text: 'You saved it! I’m going to draw it for you. With a sad face and then a happy face.', expr: 'excited' },
    ]);
    addAffinity('pipi', 16, 'quest');
  } },
];

async function villageTalk(c: VCtx, id: string, a: Actor): Promise<boolean> {
  for (const s of VSTEPS) if (s.who === id && safe(() => s.when(c))) { await s.run(c, a); refresh(); return true; }
  for (const v of VQS) if (v.giver === id && offerable(v)) return offer(c, v);
  return false;
}
let markCtx: { f: FieldScene; ground: (x: number) => number } | null = null;
function villageMark(id: string): boolean {
  const c = markCtx as unknown as VCtx | null;
  return VQS.some(v => v.giver === id && offerable(v)) || (!!c && VSTEPS.some(s => s.who === id && s.mark !== false && safe(() => s.when(c))));
}

// ================================================================== photographs
const shotHooked = new WeakSet<FieldScene>();
function hookShots(f: FieldScene) {
  if (shotHooked.has(f)) return;
  shotHooked.add(f);
  const go = (n = 0) => {
    if (!f.cam) { if (n < 40) setTimeout(() => go(n + 1), 300); return; }
    const prev = f.cam.onShot;
    f.cam.onShot = (ph: RawPhoto) => { prev?.(ph); try { onPhoto(f, ph); } catch (e) { console.warn('[sq2] photo', e); } };
  };
  go();
}
const isPred = (sp: string) => !!PREDATORS[sp] || (SPECIES_BY_ID[sp]?.danger ?? 0) >= 2;
function onPhoto(f: FieldScene, ph: RawPhoto) {
  const ok = ph.subjects.map(s => ({ s, j: judgeSubject(s, ph) })).filter(x => x.j.identified && SPECIES_BY_ID[x.s.species]);
  if (!ok.length) return;
  // Golden Hour: three species, one dusk
  if (active('sq2_golden') && !F('gold:shot') && ph.time === 'dusk') {
    const g = S().gold;
    if (g.day !== today()) { g.day = today(); g.sp = []; }
    let added = false;
    for (const { s, j } of ok) if (j.stars >= 2 && !g.sp.includes(s.species)) { g.sp.push(s.species); added = true; }
    if (added) {
      game.persist();
      if (g.sp.length >= 3) { setF('gold:shot'); void mori('Three, all gold. Hēmi’s going to cut shell to these.', 'happy'); }
      else floatNotice(`Golden hour: ${g.sp.length} of 3`, 2200);
    }
  }
  // Night Shift: five night behaviours, then the ruru calling
  if (active('sq2_night') && ph.time === 'night') {
    const nb = S().nightBeh;
    if (!F('night:five')) {
      let added = false;
      for (const { s } of ok) { if (!s.behavior) continue; const k = s.species + '|' + s.behavior; if (!nb.includes(k)) { nb.push(k); added = true; } }
      if (added) {
        game.persist();
        if (nb.length >= 5) { setF('night:five'); void mori('Five things the day never sees. Koro will want these.', 'happy'); }
        else floatNotice(`Night shift: ${nb.length} of 5`, 2200);
      }
    }
    if (F('night:five') && !F('night:ruru') && ok.some(({ s }) => s.species === 'ruru' && s.behavior === 'calling')) { setF('night:ruru'); void mori('"More-pork." Got it. The watchman. On the card.', 'happy'); }
  }
  // Eye to Eye
  if (active('sq2_eye') && !F('eye:shot')) {
    const hit = ok.find(({ s, j }) => isPred(s.species) && s.facing >= 0.7 && s.size >= 0.42 && j.stars >= 3);
    if (hit) {
      setF('eye:shot');
      audio.setDanger(0.9);
      setTimeout(() => audio.setDanger(0), 4000);
      void mori('It’s... looking at me. Right down the lens. Okay. Okay okay okay. Walk away. Walk AWAY.', 'scared', 3000);
    } else if (ok.some(({ s }) => isPred(s.species))) void floatText({ text: 'Not close enough. Jenna wants its eyes filling the frame. Facing me. Gulp.', style: 'think', ms: 2400 });
  }
  // Darkroom Master: a four-star picture
  if (active('sq2_dark') && !F('dark:shot') && ok.some(({ j }) => j.stars >= 4)) {
    setF('dark:shot');
    setV('dark:photo', ph.id);
    void mori('Four stars. That’s the one for Wellington.', 'happy');
  }
  // Eel Elder: Kui at night
  if (active('sq2_eel') && F('eel:fed3') && !F('eel:photo') && ph.time === 'night' && ok.some(({ s }) => s.species === 'tuna')) {
    setF('eel:photo');
    void mori('Kui. Hello, old girl. Look at that face. She’s smiling. Eels can’t smile. She’s smiling.', 'happy', 3000);
  }
  // The Light in the Canopy
  if (active('sq2_lure') && !F('lure:photo') && ok.some(({ s }) => s.species === 'lurevip' && s.behavior === 'luring')) {
    setF('lure:seen');
    setF('lure:photo');
    void mori('A snake. With a light on the end of its tail. Fishing. For BIRDS.', 'whisper', 2800);
  }
}
const cookReady = (f: FieldScene) => evening(f) && hasTag('fish') && hasTag('starch') && V('cook:day') !== today();
const hasTag = (tag: string) => stacks().some(s => s.n > 0 && (INGREDIENTS[s.id]?.tags as string[] | undefined)?.includes(tag));

// ================================================================== Te Kāinga: the lane, the gardens, the pou
function village(f: FieldScene, r: TripRun | null) {
  const g = (x: number) => (r ? r.groundAt(x) : f.st.terrain.groundY(x));
  markCtx = { f, ground: g };
  piglet(f, g);
  possums(f, g);
  // Guitar Night: the dawn song for Koro at the pou
  spot(f, {
    x: X.pou + 24, y: g(X.pou + 24), w: 18, label: 'Play “Te Rere o te Manu” for Koro',
    when: () => active('sq2_guitar') && songBest('manu') >= 60 && !F('gtr:dawn') && f.tod === 'dawn' && count('vil_guitar') > 0 && V('gtr:try') !== today(),
    act: async () => {
      setV('gtr:try', today());
      const p = f.player;
      p.poseOverride = 'sitGround';
      const { runGuitar } = await import('../../ui/v12/closeup/guitar');
      const res = await runGuitar({ song: 'manu', who: 'solo', world: [p.x, p.y - 20] });
      p.poseOverride = null;
      if (res.aborted) return;
      if (res.acc >= 0.85) {
        setF('gtr:dawn');
        await vsay(f, [
          { who: 'koro', text: '...', expr: 'sad' },
          { who: 'koro', text: 'Her father wrote that for my wife. For the morning we were married. He played it here, at the pou, as the sun came up the river.', expr: 'sad' },
          { who: 'koro', text: 'Nobody has played it right since. Until now. Go and tell Hana. Go on. I’ll sit here a while.', expr: 'happy' },
        ], true);
      } else await vsay(f, [{ who: 'koro', text: 'Close. The kite fell a little, near the end. Tomorrow’s dawn will come. They always do.', expr: 'neutral' }], true);
    },
  });
}

// ---------------------------------------------------------------- the runaway piglet
function piglet(f: FieldScene, g: (x: number) => number) {
  if (F('pig2:home')) return;
  // (it starts the moment the quest is on: taken on here in the village, or already running)
  let started = false;
  f.main.add(new Custom(0, () => {}, () => {
    if (started || !active('sq2_piglet') || F('pig2:home')) return;
    started = true;
    setTimeout(() => { if (live(f)) pigletStart(f, g); }, 0);
  }));
}
function pigletStart(f: FieldScene, g: (x: number) => number) {
  const live2 = new Livestock(f, g);
  const startX = F('pig2:out') ? X.leeStore - 40 : X.lane[1] - 80;
  const pig: Animal11 = live2.add('pig', startX, [X.pen[0] + 10, X.lane[1] + 40], { v: 2 });
  live2.mount(40);
  const W = X.lane[1] - 80 - (X.pen[1] - 10);
  let inStore = false, hint = false, bolt = 0;
  const p = f.player;
  f.main.add(new Custom(0, () => {}, dt => {
    if (!active('sq2_piglet') || F('pig2:home')) return;
    pig.left = 99;
    const d = pig.x - p.x;
    if (!F('pig2:found') && Math.abs(d) < 140) {
      setF('pig2:found');
      void mori('Taewa! There you are. Cabbage on your face. Okay. Slowly. Like a sheepdog.', 'say', 2800);
      bark('manu', 'Walk at his bum! Not his face!');
    }
    if (inStore) return;
    bolt = Math.max(0, bolt - dt);
    if (p.running && Math.abs(d) < 60 && bolt <= 0) {
      // he bolts, any which way
      bolt = 2.5;
      pig.tx = clamp(pig.x + (rand.chance(0.5) ? 1 : -1) * rand.range(70, 130), X.pen[0] + 10, X.lane[1] + 40);
      pig.speed = 70; pig.anim = 'walk';
      f.sfx('callGrunt', pig.x, 0.5, 1.9);
      if (!hint) { hint = true; void floatText({ text: 'Don’t RUN at him. Walk.', style: 'think', ms: 2000 }); }
    } else if (bolt <= 0 && Math.abs(d) < 64 && Math.abs(p.vx) > 8 && Math.sign(p.vx) === Math.sign(d)) {
      pig.tx = clamp(pig.x + Math.sign(d) * 46, X.pen[0] + 10, X.lane[1] + 40);
      pig.speed = 34; pig.anim = 'walk';
    } else if (pig.tx === null && rand.chance(dt * 0.25)) {
      // left alone he roots about, and drifts back toward the cabbages
      pig.anim = rand.chance(0.6) ? 'eat' : 'idle';
      if (rand.chance(0.35)) { pig.tx = clamp(pig.x + rand.range(10, 40), X.pen[0] + 10, X.lane[1] + 40); pig.speed = 12; pig.anim = 'walk'; }
    }
    setV('pig2:pct', Math.round(clamp((X.lane[1] - 80 - pig.x) / W, 0, 1) * 100));
    // the twist: he darts into the Lees' store
    if (!F('pig2:out') && pig.x < X.leeStore + 14) {
      inStore = true;
      pig.x = X.leeStore; pig.tx = null;
      const i = live2.list.indexOf(pig);
      if (i >= 0) live2.list.splice(i, 1);
      f.sfx('callGrunt', pig.x, 0.6, 2.1);
      void mori('NO. Not the store! He’s gone in the STORE.', 'shout', 2200);
      bark('manu', 'Mrs Lee’s going to kill him! Get him out!');
    }
    if (pig.x <= X.pen[1] - 6) {
      setF('pig2:home');
      pig.tx = X.pen[0] + 40; pig.speed = 16;
      audio.play('discover' as never, { vol: 0.4 });
      void mori('In the pen! Home! Manu! Rope! ROPE!', 'shout', 2400);
      refresh();
    }
  }));
  spot(f, {
    x: X.leeStore, y: g(X.leeStore), w: 22, label: 'Coax Taewa out of the store',
    when: () => inStore && !F('pig2:out'),
    act: async () => {
      p.facing = X.leeStore >= p.x ? 1 : -1;
      if (count('vil_kumara') > 0) {
        await p.doWork('kneel', 1.4);
        remove('vil_kumara', 1);
        void mori('Kūmara, Taewa? Mmm. Kūmaaara... there he is.', 'happy', 2200);
      } else {
        const res = await qte({ kind: 'ring', f, x: X.leeStore, y: g(X.leeStore) - 26, label: 'GRAB HIM!', difficulty: 0.55 });
        if (!res.ok) { void floatText({ text: 'Slippery! He’s behind the rice sacks now...', style: 'think', ms: 2000 }); return; }
      }
      setF('pig2:out');
      inStore = false;
      pig.x = X.leeStore - 30; pig.y = g(pig.x); pig.tx = null; pig.facing = -1;
      live2.list.push(pig);
      bark('mori', 'Out you come. West. That way. Home.');
    },
  });
}

// ---------------------------------------------------------------- Kūmara Night: possums in the gardens
const MOUNDS = [0, 1, 2, 3, 4].map(i => X.garden[0] + 110 + i * 19);
let possumOff: (() => void) | null = null;
function possums(f: FieldScene, g: (x: number) => number) {
  if (F('kn:won')) return;
  const p = f.player;
  const gx = (X.garden[0] + X.garden[1]) / 2;
  interface Pos { a: Animal; mound: number; feed: number; flee: number; dir: 1 | -1 }
  let on = false, spawned = 0, lost = 0, t = 0, waveT = 2;
  const list: Pos[] = [];
  possumOff?.();
  possumOff = onPredator((ev, info) => {
    if (ev !== 'plinked' || !info.a) return;
    const it = list.find(q => q.a === info.a);
    if (!it || it.flee) return;
    it.flee = 1;
    setV('kn:hits', V('kn:hits') + 1);
    f.sfx('callSqueak', it.a.x, 0.6, 1.4);
    floatNotice(V('kn:hits') >= 6 ? 'The last possum! They’re gone.' : `Possum off the kūmara (${V('kn:hits')} of 6)`, 2000);
  });
  const spawnOne = () => {
    const dir: 1 | -1 = spawned % 2 === 0 ? 1 : -1;
    const sx = dir > 0 ? X.garden[0] - 30 : X.garden[1] + 30;
    const n0 = f.animals.length;
    f.spawnRule({ species: 'sailglider', n: [1, 1], x: [sx, sx + 2], medium: 'ground', chance: 1 }, false);
    const a = f.animals[n0];
    if (!a) return;
    a.held = true; a.y = g(sx); a.facing = dir;
    list.push({ a, mound: MOUNDS[Math.floor(rand.next() * MOUNDS.length)], feed: 0, flee: 0, dir });
    spawned++;
  };
  f.main.add(new Custom(0, () => {}, dt => {
    if (!active('sq2_kumara2') || F('kn:won') || !live(f)) return;
    if (!on) {
      if (night(f) && Math.abs(p.x - gx) < 220 && V('kn:failDay') !== today()) {
        on = true;
        setF('kn:start');
        setV('kn:hits', 0);
        bark('tamati', 'Here they come. Out of the bush, look. Sling up, bro!');
        void mori('Eyes in the dark. Little ones. Lots of little ones.', 'whisper', 2200);
        audio.setDanger(0.3);
      }
      return;
    }
    t += dt;
    waveT -= dt;
    if (waveT <= 0 && spawned < 10 && list.filter(q => !q.flee && !q.a.gone).length < 3) { waveT = rand.range(2.6, 4.2); spawnOne(); }
    for (const it of list) {
      const a = it.a;
      if (a.gone) continue;
      if (it.flee) {
        a.x -= it.dir * 95 * dt; a.y = g(a.x); a.facing = (-it.dir) as 1 | -1; a.anim = 'run';
        if (Math.abs(a.x - gx) > 260) a.gone = true;
        continue;
      }
      const dx = it.mound - a.x;
      if (Math.abs(dx) > 2) { a.x += Math.sign(dx) * 16 * dt; a.anim = 'walk'; a.facing = dx > 0 ? 1 : -1; }
      else { a.anim = 'feed'; it.feed += dt; if (rand.chance(dt * 3)) f.main.particles.spawn({ frame: A.dot2, x: a.x, y: g(a.x), vx: rand.range(-20, 20), vy: -30, ay: 200, life: 0.6, color: [0.36, 0.26, 0.16], alpha: 1, alpha1: 0.3 }); }
      a.y = g(a.x);
      if (it.feed > 6) {
        it.feed = 0; it.flee = 1; lost++;
        floatNotice(`A mound dug up (${lost} of 3)`, 2000);
        bark('tamati', lost >= 3 ? 'That’s three! They’ve had the lot.' : 'Aw, not that one! My best one!');
      }
    }
    if (V('kn:hits') >= 6) {
      on = false; setF('kn:won'); audio.setDanger(0);
      possumOff?.(); possumOff = null;
      setTimeout(() => void motherPossum(f, g), 1800);
    } else if (lost >= 3) {
      on = false; setV('kn:failDay', today()); audio.setDanger(0);
      for (const it of list) it.flee = 1;
      void mori('Three mounds gone. They won tonight. Tomorrow night, possums. Tomorrow.', 'sad', 2800);
    }
  }));
}
async function motherPossum(f: FieldScene, g: (x: number) => number) {
  if (!live(f)) return;
  const sx = X.garden[0] - 20;
  const n0 = f.animals.length;
  f.spawnRule({ species: 'sailglider', n: [2, 2], x: [sx, sx + 6], herd: true, juveniles: 1, medium: 'ground', chance: 1 }, false);
  const fam = f.animals.slice(n0);
  for (const a of fam) { a.held = true; a.anim = 'feed'; a.y = g(a.x); }
  setTimeout(() => { for (const a of fam) a.gone = true; }, 45000);
  await vsay(f, [
    { who: 'mori', text: 'One more. Big one. With a... baby on her back. Oh no. Look at its little face.', expr: 'worried' },
    { who: 'tamati', text: 'Leave that one, bro. Mum and baby. She’s only feeding her kid. Like we are.', expr: 'neutral' },
    { who: 'tamati', text: 'We’ll fence. Harakeke round the mounds, the way my nan did. Give me a hand?', expr: 'happy' },
  ]);
}
async function fence(f: FieldScene, g: (x: number) => number) {
  const gx = (X.garden[0] + X.garden[1]) / 2;
  await vsay(f, [{ who: 'tamati', text: 'Stakes in, flax through, pull it tight. You pull, I tie. Go!', expr: 'serious' }]);
  const res = await qte({ kind: 'mash', f, x: gx, y: g(gx) - 30, label: 'PULL IT TIGHT!', difficulty: 0.45 });
  if (!res.ok) { await vsay(f, [{ who: 'tamati', text: 'Slack as my uncle’s jandals. Again, harder.', expr: 'teasing' }]); return; }
  setF('kn:fence');
  audio.play('rope' as never, { vol: 0.5 });
  await vsay(f, [{ who: 'tamati', text: 'Ka pai! That’ll keep the mob out. And Mum and baby can have the ones by the bush. Fair’s fair.', expr: 'happy' }]);
  addAffinity('tamati', 14, 'quest');
}

// ================================================================== camp: the darkroom, the harmonica, home safe
function camp(f: FieldScene) {
  if (active('sq2_eye') && F('eye:shot') && !F('eye:home')) {
    setF('eye:home');
    setTimeout(() => void mori('Home. Both legs. Both arms. Jenna, I have your eyes.', 'happy'), 2500);
  }
  // (taken on at the board while standing in camp: Joshu hands the harmonica over then)
  let chk = 0;
  f.main.add(new Custom(0, () => {}, dt => {
    chk -= dt;
    if (chk > 0) return;
    chk = 1;
    if (active('sq2_kea') && !F('kea:given') && !f.cutscene && !game.ui.blocking) {
      setF('kea:given');
      if (count('sq2_harmonica') < 1) give('sq2_harmonica', 1);
      refresh();
      bark('joshu', 'Here, lad. Mind it. That harmonica’s been round Cape Horn twice.', 'happy');
      setTimeout(() => floatNotice('Joshu’s harmonica (in your pack)', 2400), 1200);
    }
  }));
  const dx = CAMP_X + 250;
  const g = (x: number) => f.st.terrain.groundY(x);
  spot(f, {
    x: dx, y: g(dx), w: 18, label: 'Develop the exhibition print under the red lamp',
    when: () => active('sq2_dark') && F('dark:shot') && !F('dark:print'),
    act: async () => {
      const tk = 'dark:tries:' + today();
      if (V(tk) >= 2) { void floatText({ text: 'Jenna’s out of photo paper for today. Tomorrow.', style: 'think', ms: 2400 }); return; }
      setV(tk, V(tk) + 1);
      const id = V('dark:photo');
      const img = game.save.raw.find(p => p.id === id)?.img ?? game.save.album?.find(p => p.id === id)?.thumb;
      const { runDarkroom } = await import('../../ui/v12/closeup/darkroom');
      const res = await runDarkroom({ img, world: [dx, g(dx) - 20] });
      if (res.aborted) return;
      if (res.perfect || res.grade === 'perfect') {
        setF('dark:print');
        give('sq2_print', 1);
        void mori('Clean whites, deep blacks. Not a blotch. Wellington, here it comes.', 'happy', 2600);
      } else void mori(res.ok ? 'Close. A little muddy in the shadows. The curator would notice. The curator’s MOTHER would notice.' : 'Blotchy. Ugh. I didn’t rock it enough.', 'sad', 2600);
    },
  });
}

// ================================================================== Fernwood: the stuck kererū
const KERERU = [
  '.....vv..........',
  '.....v.ooo.......',
  '....vvoggGo......',
  '.....ogGpgeo.....',
  '....ogppppgrr....',
  '...oggpwwwgo.....',
  '..ogg2gwwwwov....',
  '.oggg22wwwwo.v...',
  '.og222g2wwwo..v..',
  '..og2222wwo...vl.',
  '...o22g2wwo...v..',
  '....oo2gwo.ll.v..',
  '...vvvoooorr..v..',
  '..v.l..v..r...v..',
  '.v.....v......vv.',
];
const KER_PAL = { o: OUT, g: '#3f7a46', G: '#5a9a5a', '2': '#2c5634', p: '#7a4a7a', w: '#f0efe6', e: '#d0302a', r: '#c8482a', v: '#3a4a20', l: '#6a8a2e' };
function fernwood(f: FieldScene, r: TripRun | null, ox: number) {
  const x = ox + 3320;
  const g = (xx: number) => (r ? r.groundAt(xx) : f.st.terrain.groundY(xx));
  const y = g(x) - 92;
  const on = () => active('sq2_kereru') && !F('ker:free');
  // the supplejack hanging out of the canopy, and the bird wound up in it
  const VINE = packColor(0.23, 0.29, 0.13, 1), LEAF = packColor(0.4, 0.52, 0.18, 1);
  f.main.add(new Custom(-2.3, (rr: Renderer) => {
    if (!on()) return;
    const top = Math.floor(rr.visibleX0(0) > x + 40 || rr.visibleX1(0) < x - 40 ? y : y - 260);
    for (let yy = top; yy < y + 6; yy++) {
      const sx = x + 4 + Math.round(Math.sin(yy * 0.07) * 2 + Math.sin(yy * 0.023) * 3);
      rr.rect(sx, yy, 1, 1, VINE);
      if (yy % 9 === 0) { rr.rect(sx + 1, yy, 2, 1, LEAF); rr.rect(sx + 2, yy - 1, 1, 1, LEAF); }
      if (yy % 13 === 4) rr.rect(sx - 2, yy, 2, 1, LEAF);
    }
  }));
  propWhen(f, 'sq2:kereru', () => ({ buf: pmap(KERERU, KER_PAL), ax: 8, ay: 14 }), x, y + 8, -2.2, on);
  const nearHoo = { t: 0 };
  f.main.add(new Custom(0, () => {}, dt => {
    if (!on() || !live(f)) return;
    nearHoo.t -= dt;
    const d = Math.abs(f.player.x - x);
    if (d < 260 && nearHoo.t <= 0) { nearHoo.t = rand.range(7, 11); void floatText({ text: 'hoo... hoo...', style: 'sad', x, y: y - 16, ms: 1600, voice: 0 }); }
    if (!F('ker:found') && d < 140) { setF('ker:found'); void mori('There! Up there, in the supplejack. Fat, green, white tummy... wound up like a parcel.', 'say', 3000); }
  }));
  spot(f, {
    x, y: g(x), w: 18, h: 22,
    label: () => (!F('ker:up') ? 'Climb up to the kererū' : 'Ease the kererū out of the vine'),
    when: () => on() && F('ker:found'),
    act: async () => {
      const p = f.player;
      if (!F('ker:up')) {
        if (!gateOk('rope')) { void mori(GATES.rope.why, 'think', 3000); return; }
        void floatText({ text: 'Rope over the branch... and up.', style: 'think', ms: 1600 });
        const res = await qte({ kind: 'seq', f, count: 6, time: 5, label: 'CLIMB!', difficulty: 0.5, pose: 'climb' });
        if (!res.ok) { void mori('Whoa. Slipped. Hands are sweaty. Again.', 'scared', 1800); return; }
        setF('ker:up');
        void mori('Hello, big bird. Don’t panic. I’m panicking enough for both of us.', 'whisper', 2400);
        return;
      }
      const res = await qte({ kind: 'hold', f, x, y: y - 10, label: 'EASE THE VINE...', difficulty: 0.55, pose: 'climb' });
      if (!res.ok) { void floatText({ text: 'It flapped. The vine pulled tight again. Slower...', style: 'think', ms: 2200 }); return; }
      setF('ker:free');
      void mori('There! Free! Off you go! ...Why are you falling? WHY ARE YOU FALLING?', 'shout', 2000);
      // it tumbles out of the vine: get under it
      const res2 = await qte({ kind: 'ring', f, x: p.x, y: y + 30, label: 'CATCH!', difficulty: 0.45 });
      for (let i = 0; i < 16; i++) f.main.particles.spawn({ frame: A.dot2, x: x + rand.range(-6, 6), y: y + rand.range(0, 20), vx: rand.range(-30, 30), vy: rand.range(-20, 20), ay: 40, life: 1.6, color: rand.chance(0.5) ? [0.25, 0.48, 0.28] : [0.94, 0.94, 0.9], alpha: 1, alpha1: 0 });
      if (res2.ok) void mori('Got you! Oof. You weigh a TON. And you smell like... fermented berries. You’re DRUNK.', 'laugh', 3000);
      else { cineShake(2, 0.3, f.st); void mori('OOF. Right on my head. It’s fine. It’s fine. It’s sitting on me. It’s drunk. It smells like wine.', 'laugh', 3200); }
      setF('ker:caught');
      setTimeout(() => void mori('There. Sleep it off in the fern, big guy. No more miro for you.', 'happy', 2600), 3400);
      addNote({ id: 'note:sq2:kereru', loc: 'fernwood', x: Math.round(x - ox), text: 'Freed a kererū from the supplejack. It was drunk on miro berries.' });
    },
  });
}

// ================================================================== the Emerald Canopy: the little light
function canopy(f: FieldScene) {
  let possum: Animal | null = null, viper: Animal | null = null, t = 0, cool = 0;
  const p = f.player;
  f.main.add(new Custom(0, () => {}, dt => {
    if (!active('sq2_lure') || !live(f)) return;
    cool -= dt;
    if (!F('lure:seen')) {
      const v = f.animals.find(a => a.species === 'lurevip' && !a.gone && Math.abs(a.x - p.x) < 320);
      if (v && evening(f)) { setF('lure:seen'); void floatText({ text: 'A light. On the branch. Moving by itself... don’t chase it. Camera.', style: 'whisper', ms: 2800 }); }
      return;
    }
    if (!F('lure:photo') || F('lure:saved') || F('lure:late')) return;
    if (!possum) {
      viper = f.animals.find(a => a.species === 'lurevip' && !a.gone) ?? null;
      if (!viper || cool > 0) return;
      const side = rand.chance(0.5) ? 1 : -1;
      const n0 = f.animals.length;
      f.spawnRule({ species: 'sailglider', n: [1, 1], x: [viper.x + side * 110, viper.x + side * 112], y: viper.y, chance: 1 }, false);
      possum = f.animals[n0] ?? null;
      if (!possum) { cool = 5; return; }
      possum.held = true; possum.y = viper.y; possum.facing = (-side) as 1 | -1;
      t = 0;
      if (f.guide) bark('aroha', 'Mori! A possum! It’s going for the light!');
      else void floatText({ text: 'Oh no. A sail possum. It’s going for the light. It thinks it’s a flower...', style: 'whisper', ms: 2600 });
      return;
    }
    t += dt;
    const vx = viper && !viper.gone ? viper.x : possum.x;
    const d = vx - possum.x;
    if (Math.abs(d) > 14) { possum.x += Math.sign(d) * 11 * dt; possum.anim = 'walk'; possum.facing = d > 0 ? 1 : -1; }
    else { possum.anim = 'idle'; }
    if (t > 9 || Math.abs(d) <= 14) {
      setF('lure:late');
      possum.held = false; possum.fear = 1; possum.threat = { kind: 'point', x: vx, y: possum.y } as never;
      f.sfx('callSqueak', possum.x, 0.7, 1.6);
      void mori('It struck! ...and missed. The possum jumped. It jumped right off the branch. Phew. PHEW.', 'scared', 3000);
      possum = null;
    }
  }));
  spot(f, {
    x: () => p.x, y: () => p.y, w: 40, h: 40, label: 'Clap! Scare the possum off', stand: false,
    when: () => !!possum && active('sq2_lure') && !F('lure:saved') && !F('lure:late'),
    act: async () => {
      const a = possum;
      if (!a) return;
      audio.play('ui' as never, { vol: 0.8, pitch: 0.6 });
      p.body.react('jump');
      setF('lure:saved');
      a.held = false; a.fear = 1; a.aw = 1.2; a.threat = { kind: 'point', x: p.x, y: p.y } as never;
      f.sfx('callSqueak', a.x, 0.7, 1.8);
      possum = null;
      void mori('*CLAP* Shoo! Not a flower! NOT A FLOWER!', 'shout', 2000);
      setTimeout(() => (f.guide ? bark('aroha', 'Ha! It’s off. And the snake looks SO annoyed.') : void mori('The viper’s pulling its light in. It looks... annoyed. Sorry, mate.', 'laugh')), 2200);
    },
  });
}

// ================================================================== Te Tuawhenua: Vos, the tramper, the kea, the eel
const VOS_X = TUA.S.scrub.x0 + 1180;
const CLUE = {
  c1: TUA.S.scrub.x0 + 720,
  c2: Math.round((TUA.S.flats.x0 + TUA.S.flats.x1) / 2) + 260,
  c3: TUA.crest[0] - 140,
  doug: TUA.S.boa.x0 + 460,
};
interface BC { t: number; seen: number; caught: number; doug: Actor | null; dougAsked: boolean; kea: KeaRun | null; nestX: number; snore: number }
const BCS = new WeakMap<FieldScene, BC>();
const bcOf = (f: FieldScene) => { let b = BCS.get(f); if (!b) { b = { t: 0, seen: 0, caught: 0, doug: null, dougAsked: false, kea: null, nestX: 0, snore: 4 }; BCS.set(f, b); } return b; };

function backcountryBuild(f: FieldScene) {
  const b = bcOf(f);
  const G = tuaGround;
  // ---- Hank's shipment: Vos's camp, his lantern, the crate
  const vosOn = () => active('sq2_shipment') && !F('ship:letter');
  void import('../../art/v11/npcs/places').then(PL => {
    propWhen(f, 'sq2:voscamp', () => PL.hunterCamp(), VOS_X, G(VOS_X) + 1, -2.4, vosOn);
  }).catch(() => {});
  propWhen(f, 'sq2:voscrate', () => findArt.glint('#8a6a44'), VOS_X + 52, G(VOS_X + 52) + 1, 3, vosOn, true);
  f.main.add(new Custom(56, rr => {
    if (!vosOn() || !night(f)) return;
    const bx = VOS_X + Math.sin(b.t * 0.55) * 170;
    rr.light(VOS_X - 6, G(VOS_X) - 22, 46, 1, 0.82, 0.5, 1.6, 0.3);
    rr.light(bx, G(bx) - 14, 64, 1, 0.86, 0.55, 1.3 + b.seen * 1.2, 0.1);
    // the lantern itself: a few warm pixels on its hook
    rr.fxRect(VOS_X - 7, G(VOS_X) - 24, 2, 3, packColor(1, 0.82, 0.4, 1), 2.4, true);
  }));
  spot(f, {
    x: VOS_X + 52, y: G(VOS_X + 52), w: 14, label: 'Ease Lily’s letter out of the crate',
    when: () => vosOn() && night(f),
    act: async () => {
      const res = await qte({ kind: 'hold', f, x: VOS_X + 52, y: G(VOS_X) - 34, label: 'QUIET...', difficulty: 0.5, pose: 'kneel' });
      if (!res.ok) {
        b.seen = Math.min(1, b.seen + 0.6);
        void floatText({ text: 'The lid CREAKED. He’s stirring...', style: 'scared', ms: 2000 });
        return;
      }
      setF('ship:letter');
      give('sq2_letter', 1);
      const [cx, cy] = f.css(VOS_X + 52, G(VOS_X) - 20);
      f.hud?.flyItem('sq2_letter', 1, 'Lily’s letter', cx, cy);
      void mori('Purple envelope. Snake sticker. That’s Lily’s. Now back out... slowly...', 'whisper', 2600);
    },
  });
  // ---- the lost tramper: tape, prints, the cairn note, Doug
  const tOn = () => active('sq2_tramper');
  propWhen(f, 'sq2:tape', () => findArt.glint('#e8c020'), CLUE.c1, G(CLUE.c1) + 1, 3, () => tOn() && !F('tramp:c1'), true);
  propWhen(f, 'sq2:prints', () => findArt.dig('#5a4a38'), CLUE.c2, G(CLUE.c2) + 2, 3, () => tOn() && !F('tramp:c2'));
  propWhen(f, 'sq2:cairn', () => findArt.glint('#c8b48a'), CLUE.c3, G(CLUE.c3) + 1, 3, () => tOn() && !F('tramp:c3'), true);
  spot(f, { x: CLUE.c1, y: G(CLUE.c1), label: 'Look at the yellow tape', when: () => tOn() && !F('tramp:c1'), act: async () => {
    setF('tramp:c1');
    await f.say([{ who: 'mori', text: 'Yellow flagging tape, tied in a neat bow. Only Doug ties a BOW. Heading east, into the backcountry.', expr: 'thinking' }]);
  } });
  spot(f, { x: CLUE.c2, y: G(CLUE.c2), label: 'Look at the boot prints', when: () => tOn() && F('tramp:c1') && !F('tramp:c2'), act: async () => {
    setF('tramp:c2');
    await f.say([
      { who: 'mori', text: 'Boot prints, into the river. Size twelve. The left one drags. He was limping already.', expr: 'worried' },
      { who: 'mori', text: 'And they come out on the far bank... going UP the burnt ridge. Doug. Why would you go UP.', expr: 'thinking' },
    ]);
  } });
  spot(f, { x: CLUE.c3, y: G(CLUE.c3), label: 'Read the note in the cairn', when: () => tOn() && F('tramp:c2') && !F('tramp:c3'), act: async () => {
    setF('tramp:c3');
    await f.say([
      { who: 'mori', text: 'A note under a stone. "Day 2. Crested one seen, E. Ankle bad. Resting in the fern gully where it’s cool. Tell Hine NOT to worry. D."', expr: 'thinking' },
      { who: 'mori', text: 'Day two. It’s been three. Hine is definitely worrying.', expr: 'worried' },
    ]);
  } });
  // ---- the kea heist: the harmonica, the chase, the nest
  const burnt = TUA.S.burnt;
  const keaX = WILD.kea[0] - 150;
  const logs = TUA.logs.filter(l => l.x > WILD.kea[1] + 420 && l.x < burnt.x1 - 60);
  b.nestX = logs[0]?.x ?? Math.min(burnt.x1 - 80, WILD.kea[1] + 900);
  if (active('sq2_kea') && F('kea:stolen') && !F('kea:back')) setF('kea:nest');
  spot(f, {
    x: keaX, y: G(keaX), w: 30, label: 'Play Joshu’s harmonica to the kea',
    when: () => active('sq2_kea') && !F('kea:stolen') && count('sq2_harmonica') > 0 && !b.kea && f.tod !== 'night',
    act: async () => { await keaPlay(f, b); },
  });
  spot(f, {
    x: () => b.nestX, y: () => G(b.nestX), w: 18, label: 'Reach into the hollow under the charred log',
    when: () => active('sq2_kea') && F('kea:nest') && !F('kea:back'),
    act: async () => {
      void floatText({ text: 'Deep breath. Hand in the dark hole with the angry parrot. Great plan.', style: 'think', ms: 2200 });
      const res = await qte({ kind: 'mash', f, x: b.nestX, y: G(b.nestX) - 26, label: 'PULL!', difficulty: 0.5, pose: 'kneel' });
      if (!res.ok) { hitMori(f, b.nestX, { sev: 1 }); void mori('IT BIT ME. It bit me and it LAUGHED.', 'scared', 2200); return; }
      setF('kea:back');
      give('sq2_harmonica', 1);
      // the twist: a nest, a chick, and everything it ever stole
      const ch = spawnKea(f, b.nestX + 16);
      ch.juvenile = true;
      await f.say([
        { who: 'mori', text: 'Got it! Harmonica... and a bottle cap, a teaspoon, a shoelace, somebody’s car key... a whole museum of stolen things.', expr: 'surprised' },
        { who: 'mori', text: 'And a CHICK. A fluffy grey chick. Okay. Okay, that explains the attitude. Sorry, mum. I’m going.', expr: 'happy' },
      ]);
    },
  });
}
async function spawnDoug(f: FieldScene, b: BC) {
  try { (await import('../../art/v11/npcs/register')).registerNpcArt(); } catch { /* */ }
  if (!live(f) || b.doug) return;
  try {
    const x = CLUE.doug;
    const a = f.addActor('doug', x, tuaGround(x), -1);
    a.z = 44;
    a.idleAnim = 'sitGround';
    a.setAnim('sitGround');
    b.doug = a;
  } catch (e) { console.warn('[sq2] doug', e); return; }
  spot(f, {
    x: CLUE.doug, y: tuaGround(CLUE.doug), w: 18, h: 22,
    label: () => (!F('tramp:found') ? 'Doug!' : 'Splint Doug’s ankle'),
    when: () => active('sq2_tramper') && F('tramp:c3') && !F('tramp:splint'),
    act: async () => {
      if (!F('tramp:found')) {
        setF('tramp:found');
        await f.say([
          { who: 'doug', text: 'Mori! Mori, lad! Get DOWN. Shh. Shhh. It was just here. The crested one. Just there. On that branch.', expr: 'excited' },
          { who: 'mori', text: 'Doug. Doug. Hine’s worried sick. You’ve been gone three days. Your ankle is the size of a melon.', expr: 'worried' },
          { who: 'doug', text: 'Is it? Oh. Yes. It is rather. Ow. I hadn’t looked. I was looking at the bird.', expr: 'sad' },
        ]);
        return;
      }
      const res = await qte({ kind: 'seq', f, count: 5, time: 5, label: 'SPLINT!', difficulty: 0.45, pose: 'kneel' });
      if (!res.ok) { await f.say([{ who: 'doug', text: 'OW. Ow ow. That’s the wrong way, lad. The foot goes the OTHER way.', expr: 'scared' }]); return; }
      setF('tramp:splint');
      await f.say([
        { who: 'doug', text: 'Oh, that’s much better. Two sticks and a bootlace. You’d make a ranger, you know.', expr: 'happy' },
        { who: 'doug', text: 'And Mori... between us. The crested one. I got a good look, finally. Twenty-four years.', expr: 'serious' },
        { who: 'doug', text: 'It was a kea. With a feather stuck on its head. Don’t tell Hine. I’ll hobble home slow. You go and tell her I’m fine.', expr: 'laugh' },
      ]);
      const a = b.doug;
      if (a) { a.idleAnim = 'idle'; a.setAnim('idle'); void a.walkTo(TUA.S.boa.x0 - 400, 22).then(() => { if (live(f)) { a.layer?.remove(a); f.actors.delete('doug'); } }); }
    },
  });
}

// ---------------------------------------------------------------- the kea heist
interface KeaRun { a: Animal; pts: number[]; i: number; mode: 'in' | 'steal' | 'fly' | 'toy' | 'home'; t: number; fx: number; fy: number; tx: number; ty: number; dur: number; grabbed: boolean }
async function keaPlay(f: FieldScene, b: BC) {
  const p = f.player;
  p.poseOverride = 'idle';
  void floatText({ text: 'hwee-hoo-hwaaa... hoo-hwee...', style: 'happy', ms: 2200, voice: 0 });
  audio.play('pluck' as never, { vol: 0.4, pitch: 1.5 });
  await sleep(900);
  audio.play('pluck' as never, { vol: 0.4, pitch: 1.2 });
  await sleep(900);
  p.poseOverride = null;
  if (!live(f)) return;
  // a kea comes in to see, lands right beside him, and goes for the harmonica
  const side: 1 | -1 = p.facing >= 0 ? 1 : -1;
  const a = spawnKea(f, p.x + side * 220, { home: [WILD.kea[0] - 300, b.nestX + 200] });
  a.held = true;
  const dir: 1 | -1 = b.nestX > p.x ? 1 : -1;
  const n = 4, span = b.nestX - p.x;
  const pts = Array.from({ length: n }, (_, i) => Math.round(p.x + span * ((i + 1) / (n + 1)) + rand.range(-30, 30)));
  b.kea = { a, pts, i: 0, mode: 'in', t: 0, fx: a.x, fy: a.y - 40, tx: p.x + side * 16, ty: tuaGround(p.x + side * 16), dur: 1.6, grabbed: false };
  void mori('One’s coming! It likes it! Joshu, your bosun was RIGHT—', 'happy', 1800);
  void dir;
}
function keaUpdate(f: FieldScene, b: BC, dt: number) {
  const k = b.kea;
  if (!k) return;
  const a = k.a, p = f.player;
  if (a.gone) { b.kea = null; return; }
  k.t += dt;
  const fly = (anim: string) => {
    const u = clamp(k.t / k.dur, 0, 1);
    a.x = k.fx + (k.tx - k.fx) * u;
    a.y = k.fy + (k.ty - k.fy) * u - Math.sin(u * Math.PI) * Math.min(60, Math.abs(k.tx - k.fx) * 0.25 + 10);
    a.facing = k.tx >= k.fx ? 1 : -1;
    a.anim = anim;
    return u >= 1;
  };
  const go = (tx: number) => { k.fx = a.x; k.fy = a.y; k.tx = tx; k.ty = tuaGround(tx); k.dur = Math.max(0.8, Math.abs(tx - a.x) / 150); k.t = 0; k.mode = 'fly'; a.anim = 'flash'; };
  switch (k.mode) {
    case 'in':
      if (fly('fly')) { k.mode = 'steal'; k.t = 0; a.face(p.x); }
      break;
    case 'steal':
      a.anim = 'peck';
      a.face(p.x);
      if (k.t > 1.8) {
        remove('sq2_harmonica', 1);
        refresh();
        setF('kea:stolen');
        a.call('contact');
        a.showEmote('heart', 1.2, true);
        void mori('HEY! That’s Joshu’s! Give it BACK, you feathered thief!', 'shout', 2400);
        go(k.pts[0]);
      }
      break;
    case 'fly':
      if (k.t < 0.35) { a.anim = 'flash'; break; }
      if (fly('carry')) { k.mode = 'toy'; k.t = 0; a.anim = 'toy'; k.grabbed = false; a.showEmote('music', 1.2); }
      break;
    case 'toy': {
      a.anim = 'toy';
      const d = Math.abs(p.x - a.x);
      if (p.running && d < 80 && k.t > 0.4) { void floatText({ text: 'Too fast, it saw me coming! Sprint, then WALK...', style: 'think', ms: 2000 }); next(); break; }
      if (!k.grabbed && d < 34 && !f.cutscene) {
        k.grabbed = true;
        void (async () => {
          f.cutscene = true;
          const res = await qte({ kind: 'ring', f, x: a.x, y: a.y - 22, label: 'GRAB!', difficulty: 0.5 });
          f.cutscene = false;
          if (b.kea !== k) return;
          if (res.ok) {
            setF('kea:back');
            give('sq2_harmonica', 1);
            refresh();
            a.held = false;
            a.setAct('flee', 20);
            b.kea = null;
            void mori('GOT IT! Ha! Who’s the cheeky one now? ...It’s laughing at me. How is it laughing at me.', 'laugh', 2800);
          } else { void mori('Missed! It hopped! It HOPPED.', 'shout', 1600); next(); }
        })();
        break;
      }
      if (k.t > 3.6 && !k.grabbed) next();
      break;
    }
    case 'home':
      if (fly('carry')) { a.gone = true; setF('kea:nest'); b.kea = null; void floatText({ text: 'It went into the hollow under that charred log. Its nest. Of course it has a nest.', style: 'think', ms: 3000 }); }
      break;
  }
  function next() {
    const r = b.kea;
    if (!r) return;
    r.i++;
    if (r.i < r.pts.length) go(r.pts[r.i]);
    else { go(b.nestX); r.mode = 'home'; }
  }
}

// ---------------------------------------------------------------- per frame in the backcountry
const TOOK_TAG = Symbol('sq2took');
function backcountryUpdate(f: FieldScene, dt: number) {
  const b = bcOf(f), p = f.player;
  if (!p) return;
  b.t += dt;
  // Eel Elder: chain the eel's "it ate" (the encounter module sets it; wrap whatever is there now)
  const took = TUNA_CTX.took as typeof TUNA_CTX.took & { [TOOK_TAG]?: boolean };
  if (!took[TOOK_TAG]) {
    const prev = took;
    const mine = ((a: Animal, x: number) => { prev(a, x); eelAte(); }) as typeof TUNA_CTX.took & { [TOOK_TAG]?: boolean };
    mine[TOOK_TAG] = true;
    TUNA_CTX.took = mine;
  }
  // Hank's shipment: the lantern swings; out of the light, or low in cover
  if (active('sq2_shipment') && !F('ship:letter') && night(f)) {
    const d = Math.abs(p.x - VOS_X);
    if (!F('ship:found') && d < 320) { setF('ship:found'); void mori('A tarp, a fire ring, a lantern... and a crate with HANK scratched on it. And snoring.', 'whisper', 2800); }
    b.snore -= dt;
    if (b.snore <= 0 && d < 400) { b.snore = rand.range(5, 8); void floatText({ text: 'hnnngh... snrk... my FLARES...', style: 'whisper', x: VOS_X - 10, y: tuaGround(VOS_X) - 30, ms: 1800, name: 'Vos', color: '#8a6a3a', voice: 0.55 }); }
    const bx = VOS_X + Math.sin(b.t * 0.55) * 170;
    const lit = Math.abs(p.x - bx) < 54 && d < 280;
    if (lit && !moriHidden(f)) { b.seen += dt * 1.5; audio.setDanger(0.4 + b.seen * 0.6); }
    else { b.seen = Math.max(0, b.seen - dt * 0.4); if (d < 320) audio.setDanger(0.25); }
    if (b.seen >= 1 && b.t - b.caught > 4) {
      b.caught = b.t; b.seen = 0;
      void floatText({ text: 'WHO’S THERE? Mulvaney, is that you? GET OUT OF MY CAMP!', style: 'shout', x: VOS_X, y: tuaGround(VOS_X) - 36, ms: 2400, name: 'Vos', color: '#8a6a3a', voice: 0.55 });
      hitMori(f, VOS_X, { sev: 1, what: 'a boot' });
      p.vx = -Math.sign(VOS_X - p.x || 1) * 220;
      setTimeout(() => void floatText({ text: 'He threw a BOOT at me. Out of the light, Mori. Low. Slow.', style: 'think', ms: 2400 }), 1600);
    }
  }
  // the tramper: Doug is in the gully once his note has been read (this visit or an earlier one)
  if (active('sq2_tramper') && F('tramp:c3') && !F('tramp:splint') && !b.doug && !b.dougAsked) { b.dougAsked = true; void spawnDoug(f, b); }
  keaUpdate(f, b, dt);
}
function eelAte() {
  if (!active('sq2_eel') || F('eel:fed3')) return;
  const days = S().eelDays;
  if (days.includes(today())) { void floatText({ text: 'She ate. Rāwiri said once a day, so she learns me. Tomorrow again.', style: 'think', ms: 2400 }); return; }
  days.push(today());
  game.persist();
  if (days.length >= 3) { setF('eel:fed3'); void mori('Third day. She came straight up to me. She KNOWS me now.', 'happy', 2600); }
  else floatNotice(`Fed Kui (${days.length} of 3 days)`, 2400);
}

// ================================================================== registration
const ALL_IDS = [...VQS.map(v => v.def.id), ...REQS.map(r => r.id), ...NQS.map(n => n.id)];
let registered = false;
/** put the fourteen quests in the quest book, the board and the NPC menus, and hook the scenes (idempotent) */
export function registerSideQuests2() {
  if (registered) return;
  registered = true;
  defs();
  const add = (d: QuestDef) => { if (!QUEST_BY_ID[d.id]) { QUESTS.push(d); QUEST_BY_ID[d.id] = d; } };
  for (const v of VQS) add(v.def);
  for (const r of REQS) {
    if (!REQ_BY_ID[r.id]) { REQUESTS.push(r); REQ_BY_ID[r.id] = r; }
    const steps = [...r.steps];
    if (r.give) steps.push({ text: `Hand ${r.give.map(([id, n]) => `${n > 1 ? n + ' ' : ''}${ITEMS[id]?.name ?? id}`).join(' and ')} in at the camp board`, done: () => !!game.save.flags[`v10:req:${r.id}:given`], hint: 'The board on two driftwood posts, between the drying rack and Aroha’s lean-to.' });
    add({ id: r.id, title: r.title, giver: (r.giver === 'agency' ? 'story' : r.giver) as Giver, main: false, desc: r.desc, steps, reward: { rp: r.reward.rp, items: r.reward.items, text: r.reward.text } });
  }
  for (const n of NQS) {
    if (!NPC_QUEST_BY_ID[n.id]) { NPC_QUESTS.push(n); NPC_QUEST_BY_ID[n.id] = n; }
    add({ id: n.id, title: n.title, giver: n.giver as Giver, main: false, desc: n.desc, steps: n.steps, reward: { rp: n.reward.rp, items: n.reward.items, text: n.reward.text } });
  }
  // the village's talk and "!" hooks
  void import('../v11/village/people').then(m => {
    m.SIDE_HOOKS.talk.push(villageTalk);
    m.SIDE_HOOKS.mark.push(villageMark);
  }).catch(e => console.warn('[sq2] village hooks', e));
  // the scenes
  onLocEnter((f, loc, r) => {
    hookShots(f);
    try {
      if (loc === 'village') village(f, r);
      else if (loc === 'island') camp(f);
      else if (loc === 'fernwood' || loc === 'forest') void import('./region').then(m => fernwood(f, r, loc === 'forest' ? m.toWorld('fernwood', 0) : 0));
      else if (loc === 'canopy') canopy(f);
    } catch (e) { console.warn('[sq2] scene', loc, e); }
  });
  tuaHooks.build.push(f => { try { backcountryBuild(f); } catch (e) { console.warn('[sq2] backcountry', e); } });
  tuaHooks.update.push((f, dt) => { try { backcountryUpdate(f, dt); } catch (e) { console.warn('[sq2] backcountry update', e); } });
  // every finished one counts
  setInterval(() => {
    let n = 0;
    for (const id of ALL_IDS) if (done(id) && !F('counted:' + id)) { game.save.flags['sq2:counted:' + id] = true; n++; }
    if (n) { game.save.vars['side:done'] = (game.save.vars['side:done'] ?? 0) + n; game.persist(); }
  }, 1500);
}
/** the quest ids (dev points, the camp report) */
export const SIDE_QUESTS2 = ALL_IDS;
void addRP; void WHITE; void KEA_ID; void VQ_BY;
