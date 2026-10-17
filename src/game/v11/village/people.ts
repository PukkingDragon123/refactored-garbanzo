// V11 the people of Te Kāinga: who they are, what they do through the day (each villager walks
// between a few work stations, the kids run about, everyone gathers at the fire after dark), what
// they say to each other when they meet, and what they say to Mori.
//
//   Koro Wiremu   the elder: sits on the paepae of the wharenui, keeps Hinerua's story, makes the
//                 offering at the pou when the sun is low, gives the blessing for the old track
//   Nanny Huia    his sister, the kuia: the hāngī and the cooking fire; fried bread; the boil-up
//   Whaea Mere    the weaver, under the shelter by the pig pen; a kete for Mori, bread for the road
//   Tamati        her husband, in the kūmara gardens
//   Manu        their son (15): the pigs, the hens, the goats, the dogs
//   Rāwiri        the fisher: the landing, the eel traps, the smoking rack
//   Uncle Hēmi    his father, the carver: the waka on its trestles in the carving shed
//   Aunty Hana   Aroha's aunty, the musician: the hue kiri on her bench, the dance practice
//   Pīpī, Ani, Mikaere   the kids: running, the ball, the rooster, the mud

import type { Actor } from '../../../world/actor';
import type { Interactable } from '../../../world/npc';
import type { BubbleLine } from '../../../ui/bubbles';
import { Custom } from '../../../world/props';
import { game } from '../../game';
import { audio } from '../../../core/audio';
import { rand } from '../../../core/math';
import { add, count, remove, give } from '../../inventory';
import { ITEMS } from '../../items';
import { rumour, addNote, discover } from '../../v10/regions';
import { addBond } from '../../v10/day';
import { teachRecipe, knowsRecipe } from '../cooking';
import { meet, addAffinity, definePerson, PEOPLE } from '../social';
import { questStatus } from '../../quests';
import { setCarry } from '../carry';
import type { VCtx, Station, VillagerRT } from './ctx';
import { say, bark, sleep, actorOf } from './ctx';
import { X } from './layout';
import { vf, setVf, vv, setVv, blessed, startVillageQuest, CHATTER, KID_BARKS } from './lore';

// ------------------------------------------------------------------ who
interface VDef {
  id: string;
  name: string;
  adult: boolean;
  day: Station[];
  dawn?: Station[];
  dusk?: Station[];
  night: Station[];
  /** the festival night */
  fest?: Station;
  /** kids: roam this range by day */
  roam?: [number, number];
}
const fireL = (dx: number, anim: string): Station => ({ x: X.fire - dx * 1.25, anim, face: 1, stay: 999 });
const fireR = (dx: number, anim: string): Station => ({ x: X.fire + dx * 1.25, anim, face: -1, stay: 999 });
export const VILLAGERS: VDef[] = [
  { id: 'koro', name: 'Koro Wiremu', adult: true,
    day: [{ x: X.koroSeat, anim: 'sit', face: -1, stay: 70 }, { x: X.marae[0] + 40, anim: 'armsCrossed', face: 1, stay: 18 }, { x: X.wakaBuild - 44, anim: 'talk', face: 1, stay: 22 }],
    dawn: [{ x: X.pou + 20, anim: 'bless', face: -1, stay: 999 }],
    dusk: [{ x: X.pou + 20, anim: 'armsCrossed', face: -1, stay: 999 }],
    night: [fireL(36, 'storyTell')], fest: { x: X.koroSeat, anim: 'sit', face: 1, stay: 999 } },
  { id: 'huia', name: 'Nanny Huia', adult: true,
    day: [{ x: X.cookFire - 10, anim: 'stir', face: 1, stay: 40 }, { x: X.hangi + 18, anim: 'kneelWork', face: -1, stay: 20 }, { x: X.foodBench - 8, anim: 'craft', face: 1, stay: 25 }],
    night: [fireR(78, 'sit')], fest: { x: X.hangi + 18, anim: 'stir', face: -1, stay: 999 } },
  { id: 'mere', name: 'Whaea Mere', adult: true,
    day: [{ x: X.shelter, anim: 'craft', face: 1, stay: 60 }, { x: X.flax + 6, anim: 'kneelWork', face: 1, stay: 16 }],
    dusk: [{ x: X.hangi - 18, anim: 'talk', face: 1, stay: 30 }, { x: X.shelter, anim: 'craft', face: 1, stay: 30 }],
    night: [fireR(62, 'sit')], fest: { x: X.fire + 30, anim: 'snakeDance', face: -1, stay: 999 } },
  { id: 'tamati', name: 'Tamati', adult: true,
    day: [{ x: X.garden[0] + 90, anim: 'dig', face: 1, stay: 34 }, { x: X.garden[0] + 200, anim: 'kneelWork', face: 1, stay: 26 }, { x: X.kumaraKete + 8, anim: 'carryIdle~crate', face: 1, stay: 6 }],
    night: [fireR(96, 'armsCrossed')], fest: { x: X.hangi - 14, anim: 'cheer', face: -1, stay: 999 } },
  { id: 'manu', name: 'Manu', adult: false,
    day: [{ x: X.pen[0] + 44, anim: 'pour', face: 1, stay: 24 }, { x: X.coop - 18, anim: 'kneelWork', face: 1, stay: 18 }, { x: X.goats[0] + 10, anim: 'pet', face: 1, stay: 16 }],
    night: [fireR(48, 'sitGround')], fest: { x: X.fire + 52, anim: 'snakeDance', face: -1, stay: 999 } },
  { id: 'rawiri', name: 'Rāwiri', adult: true,
    day: [{ x: 150, anim: 'fishWait', face: -1, stay: 60 }, { x: X.hinaki + 6, anim: 'kneelWork', face: -1, stay: 18 }, { x: X.smokeRack - 18, anim: 'craft', face: 1, stay: 22 }],
    dusk: [{ x: X.smokeRack - 18, anim: 'craft', face: 1, stay: 40 }, { x: 150, anim: 'fishWait', face: -1, stay: 40 }],
    night: [fireL(66, 'talk')], fest: { x: X.marae[0] - 8, anim: 'strum', face: 1, stay: 999 } },
  { id: 'hemi', name: 'Uncle Hēmi', adult: true,
    day: [{ x: X.wakaBuild - 26, anim: 'hammer', face: 1, stay: 50 }, { x: X.wakaBuild + 40, anim: 'hammer', face: -1, stay: 30 }, { x: X.shed - 50, anim: 'armsCrossed', face: 1, stay: 12 }],
    night: [fireL(84, 'sit')], fest: { x: X.marae[0] + 12, anim: 'cheer', face: 1, stay: 999 } },
  { id: 'hana', name: 'Aunty Hana', adult: true,
    day: [{ x: X.hanaBench, anim: 'strumSit', face: -1, stay: 50 }, { x: X.marae[0] + 90, anim: 'snakeDance', face: 1, stay: 24 }],
    night: [fireR(114, 'strum')], fest: { x: X.fire - 30, anim: 'snakeDance', face: 1, stay: 999 } },
  { id: 'pipi', name: 'Pīpī', adult: false, roam: [1560, 1960], day: [], night: [fireR(26, 'sitGround')], fest: { x: X.fire - 50, anim: 'snakeDance', face: 1, stay: 999 } },
  { id: 'ani', name: 'Ani', adult: false, roam: [1560, 1960], day: [{ x: X.marae[0] + 116, anim: 'snakeDance', face: -1, stay: 20 }], night: [fireR(36, 'sitGround')], fest: { x: X.fire + 70, anim: 'snakeDance', face: -1, stay: 999 } },
  { id: 'mikaere', name: 'Mikaere', adult: false, roam: [1400, 2050], day: [], night: [fireL(16, 'sitGround')], fest: { x: X.marae[1] + 20, anim: 'jump', face: -1, stay: 999 } },
];
const NAME: Record<string, string> = Object.fromEntries(VILLAGERS.map(v => [v.id, v.name]));
export const villagerName = (id: string) => NAME[id] ?? id;

/** the relationships registry knows everyone here (the social module owns what it does with them) */
/** who they are for the people book (the relationships module reads age, role, blurb and gift tastes) */
const BOOK: Record<string, { age: number; role: string; blurb: string; loves: string[]; likes: string[]; dislikes?: string[]; color: string }> = {
  koro: { age: 78, role: 'Elder of Te Kāinga, Aroha’s grandfather', blurb: 'Keeps the story of Hinerua, the river’s guardian, and gives the blessing for the old track. Sits on the paepae of the wharenui and misses nothing.', loves: ['taonga_toggle', 'taonga_toki', 'taonga_matau', 'vil_tea'], likes: ['vil_rewena', 'kawakawa', 'tea'], color: '#6a5e4c' },
  huia: { age: 74, role: 'Kuia, Koro’s older sister, keeper of the hāngī', blurb: 'Everybody’s nanny. Feeds anyone who stands still long enough. Teaches the boil-up.', loves: ['v10_fish', 'vil_tuna'], likes: ['vil_kumara', 'kawakawa', 'berry_gold'], color: '#78242c' },
  mere: { age: 52, role: 'Weaver, Aroha’s aunt', blurb: 'Weaves under the shelter by the pig pen, fingers never still. Made Mori his kete. Has words for Jenna’s translator.', loves: ['flax', 'rope'], likes: ['vil_tea', 'berry_dusk'], color: '#a8342c' },
  tamati: { age: 46, role: 'Gardener, Whaea Mere’s husband', blurb: 'Grows the kūmara. Knows every mound by name. Thinks scientists walk like people who have never weeded.', loves: ['vil_kumara'], likes: ['vil_rewena', 'grub'], color: '#8a2016' },
  manu: { age: 15, role: 'Mere and Tamati’s son, keeps the animals', blurb: 'Pigs, hens, goats, dogs, and Captain the rooster, who hates everyone. Polite when his mum is watching.', loves: ['berry_ember'], likes: ['vil_paraoa', 'ration'], color: '#464c54' },
  rawiri: { age: 27, role: 'Fisher, Aroha’s cousin', blurb: 'Sets the hīnaki and smokes the tuna. Saw strange boat lights off the east coast.', loves: ['v10_fish', 'mussel'], likes: ['vil_tuna', 'vil_kumara'], color: '#386c3c' },
  hemi: { age: 56, role: 'Carver, Rāwiri’s father', blurb: 'Carving a waka out of a single tōtara in the shed. Says little, carves a lot.', loves: ['wood', 'driftwood'], likes: ['vil_hangi', 'tea'], color: '#5a3418' },
  hana: { age: 34, role: 'Musician, Aroha’s aunty', blurb: 'Plays the hue kiri and leads the serpent dance. Teaches anyone who brings her a shed skin from the reeds.', loves: ['vil_kiri'], likes: ['berry_gold', 'moonfruit', 'vil_paraoa'], color: '#1e5c68' },
  pipi: { age: 8, role: 'Aroha’s little cousin', blurb: 'Wants her photo taken. Does her scary face. It is not scary.', loves: ['berry_gold'], likes: ['vil_paraoa', 'moonfruit'], color: '#c49428' },
  ani: { age: 10, role: 'Pīpī’s best friend and rival', blurb: 'Dances like water, she says. Dares visitors to catch the rooster.', loves: ['berry_ember'], likes: ['vil_paraoa'], color: '#682a84' },
  mikaere: { age: 7, role: 'A small boy, always running', blurb: 'The fastest in the whole village, if you weren’t watching. Often muddy.', loves: ['moonfruit'], likes: ['berry_dusk'], color: '#1c468a' },
};
export function defineVillagePeople() {
  for (const v of VILLAGERS) {
    const b = BOOK[v.id];
    // extended fields the relationships module knows (a plain object, so it stays compatible with any version of the registry)
    const d = { id: v.id, name: v.name, group: 'village', adult: v.adult, home: 'village', where: 'Te Kāinga, up the river from the mangroves', ...(b ?? {}) };
    definePerson(d);
  }
}

// ------------------------------------------------------------------ spawning and routines
export function stationsFor(v: VDef, c: VCtx): Station[] {
  if (c.festival && v.fest) return [v.fest];
  if (c.night) return v.night;
  if (c.tod === 'dawn' && v.dawn) return v.dawn;
  if (c.tod === 'dusk' && v.dusk) return v.dusk;
  return v.day.length ? v.day : v.night;
}

export function spawnVillagers(c: VCtx) {
  const f = c.f;
  for (const v of VILLAGERS) {
    const st = stationsFor(v, c);
    const kidDay = !c.night && !c.festival && !!v.roam;
    const s0 = st[0];
    const x0 = kidDay ? rand.range(v.roam![0], v.roam![1]) : s0.x;
    const a = f.addActor(v.id, x0, c.ground(x0), s0?.face ?? -1);
    a.z = 44;
    a.idleAnim = kidDay ? 'idle' : s0.anim;
    a.setAnim(a.idleAnim);
    const rt: VillagerRT = { id: v.id, a, stations: st, i: 0, t: s0?.stay !== undefined && s0.stay < 999 ? rand.range(4, s0.stay) : 999, roam: kidDay ? v.roam : undefined, held: false };
    if (kidDay) rt.t = rand.range(1, 4);
    c.vill[v.id] = rt;
    addTalk(c, v.id, a);
  }
  // routines and chatter tick with the scene
  let chatT = rand.range(5, 9), kidT = 6;
  f.main.add(new Custom(0, () => {}, dt => {
    if (c.hold || f.cutscene) return;
    for (const rt of Object.values(c.vill)) tickRoutine(c, rt, dt);
    chatT -= dt;
    if (chatT <= 0 && !game.ui.bubbles.active) { chatT = rand.range(9, 16); chatter(c); }
    kidT -= dt;
    if (kidT <= 0 && !c.night) {
      kidT = rand.range(7, 14);
      const kids = ['pipi', 'ani', 'mikaere'].map(id => c.vill[id]).filter(k => k && !k.held && Math.abs(k.a.x - f.player.x) < 260);
      const k = kids.length ? rand.pick(kids) : null;
      if (k && !game.ui.bubbles.active) bark(k.id, rand.pick(KID_BARKS), { expr: 'excited' });
    }
  }));
}

function tickRoutine(c: VCtx, rt: VillagerRT, dt: number) {
  if (rt.held) return;
  const a = rt.a;
  if (a.walking) return;
  rt.t -= dt;
  if (rt.t > 0) return;
  if (rt.roam) {
    // kids: run somewhere, then a moment of something (a cheer, a laugh, catching breath, a wave)
    rt.t = rand.range(2.5, 6);
    const tx = rand.range(rt.roam[0], rt.roam[1]);
    const run = rand.next() < 0.7;
    void a.walkTo(tx, run ? rand.range(80, 110) : 40, run ? 'run' : 'walk').then(() => {
      if (rt.held) return;
      const what = rand.pick(['idle', 'cheer', 'laugh', 'wave', 'idle', 'jump', 'point']);
      a.idleAnim = 'idle';
      if (what === 'idle') a.setAnim('idle'); else void a.play(what, 'idle');
    });
    return;
  }
  if (rt.stations.length < 2) { rt.t = 999; return; }
  rt.i = (rt.i + 1) % rt.stations.length;
  const s = rt.stations[rt.i];
  rt.t = s.stay !== undefined ? s.stay * rand.range(0.8, 1.2) : rand.range(18, 40);
  const carry = s.anim.startsWith('carryIdle~') ? s.anim.split('~')[1] : null;
  if (carry) setCarry(a, carry as never);
  void a.walkTo(s.x, 38, carry ? undefined : 'walk').then(() => {
    if (rt.held) return;
    if (s.face) a.facing = s.face;
    if (carry) { setCarry(a, null); a.idleAnim = 'idle'; a.setAnim('idle'); return; }
    a.idleAnim = s.anim;
    a.setAnim(s.anim);
  });
}

/** two villagers near each other (and near Mori) have a word */
function chatter(c: VCtx) {
  const p = c.f.player;
  const ok = CHATTER.filter(ch => {
    const A = c.vill[ch.a]?.a, B = c.vill[ch.b]?.a;
    return A && B && !c.vill[ch.a].held && !c.vill[ch.b].held && Math.abs(A.x - B.x) < 150 && Math.abs((A.x + B.x) / 2 - p.x) < 280;
  });
  if (!ok.length) return;
  const ch = rand.pick(ok);
  const [l1, l2] = rand.pick(ch.lines);
  const A = c.vill[ch.a].a, B = c.vill[ch.b].a;
  A.faceTo(B.x); B.faceTo(A.x);
  bark(ch.a, l1, { expr: 'happy' });
  setTimeout(() => { if (game.scene === c.f && !c.hold) bark(ch.b, l2, { expr: rand.pick(['laugh', 'teasing', 'happy', 'neutral']) }); }, 2600);
}

/** take a villager out of their routine for a scripted moment (and give them back) */
export function holdV(c: VCtx, id: string, on: boolean) {
  const rt = c.vill[id];
  if (!rt) return;
  rt.held = on;
  if (on) rt.a.stopWalk();
  else rt.t = rand.range(3, 8);
}

// ------------------------------------------------------------------ talking
const firstMeet = (id: string) => {
  const k = 'met:' + id;
  if (vf(k)) return false;
  setVf(k);
  meet(id);
  addAffinity(id, 3, 'met at Te Kāinga');
  return true;
};

function addTalk(c: VCtx, id: string, a: Actor) {
  const f = c.f;
  (f.interact as Interactable[]).push({
    get x() { return a.x; }, get y() { return a.y; }, w: 14, h: 22, label: `Talk to ${villagerName(id)}`, get standX() { return a.x - 22 * a.facing; },
    quest: () => questMark(id),
    action: async () => {
      if (f.cutscene || c.hold) return;
      f.cutscene = true;
      holdV(c, id, true);
      const prev = a.anim, prevIdle = a.idleAnim;
      a.faceTo(f.player.x);
      const sitting = /sit|Sit|craft|kneel|dig/.test(a.anim);
      if (!sitting) a.setAnim('talk');
      try {
        firstMeet(id);
        await (TALK[id] ?? talkGeneric)(c, a);
      } catch (e) { console.error(e); }
      finally {
        f.cutscene = false;
        f.hud?.refresh();
        if (!c.hold) {
          a.idleAnim = prevIdle;
          a.setAnim(prev === 'talk' ? prevIdle : prev);
          holdV(c, id, false);
        }
      }
    },
  } as Interactable);
}

/** the quest marker floats over whoever the tracked village quest needs next */
function questMark(id: string): boolean {
  if (questStatus('v11_hinerua') === 'active') {
    if (id === 'koro' && (!vf('askPou') || (vf('askPou') && !vf('story')) || (vf('skinFound') && !vf('offering')) || (vf('offering') && !blessed()))) return true;
  }
  if (questStatus('v11_huekiri') === 'active' && id === 'hana' && (!vf('heardHana') || (!vf('kiriGiven') && count('vil_kiri') > 0) || (vf('kiriGiven') && !vf('song:awa')))) return true;
  if (questStatus('v11_festival') === 'active') {
    if (id === 'huia' && (!vf('prep:kai') && count('v10_fish') + count('vil_tuna') >= 2)) return true;
    if (id === 'hana' && !vf('prep:dance')) return true;
  }
  return false;
}

type Talk = (c: VCtx, a: Actor) => Promise<void>;
const think = (text: string, choices: string[]): BubbleLine => ({ who: 'mori', text, style: 'think', choices });

async function talkGeneric(c: VCtx, a: Actor) {
  await say(c.f, [{ who: a.id, text: 'Kia ora!', expr: 'happy' }]);
}

const TAONGA: Record<string, string> = { taonga_toggle: 'the pounamu toggle', taonga_toki: 'the stone toki', taonga_matau: 'the bone matau' };

// ---------------------------------------------------------------- Koro
async function talkKoro(c: VCtx) {
  const f = c.f;
  const R = await import('./ritual');
  // taonga coming home first, always
  const back = Object.keys(TAONGA).filter(id => count(id) > 0);
  if (back.length) {
    for (const id of back) {
      remove(id, 1);
      game.save.flags['v10:returned:' + id] = true;
      discover({ id: 'vil:returned:' + id, kind: 'village', name: `${ITEMS[id].name} returned`, loc: 'village', x: X.koroSeat, note: `Returned ${TAONGA[id]} to Koro Wiremu.` }, true);
    }
    give('vil_rewena', 2);
    give('vil_kumara', 2);
    addAffinity('koro', 12 * back.length, 'returned taonga');
    addBond('aroha', 4);
    audio.play('discover');
    await say(f, [
      { who: 'mori', text: `Koro... we found ${back.map(id => TAONGA[id]).join(' and ')}. Aroha said it should come home.`, expr: 'neutral' },
      { who: 'koro', text: back.includes('taonga_toggle') ? 'E hoa... this toggle was my grandmother’s grandmother’s. She lost it diving for kōura in the cave that breathes. We sang for it for a hundred years.' : 'You carried this all the way here, and gave it back. That tells me who you are.', expr: 'happy' },
      { who: 'koro', text: 'Take kai for the road. And you are welcome here, always. Ka pai, e tama.', expr: 'happy' },
    ], true);
    game.ui.toast('Taonga returned. Koro gave you <b>rēwena</b> and <b>kūmara</b>.', 'VILLAGE', 'teal', 3600);
    game.save.flags['v10:koroTalked'] = true;
    return;
  }
  startVillageQuest('v11_hinerua', true);
  // what Koro has for Mori now, in the order the story goes
  if (!vf('askPou')) {
    setVf('askPou');
    addAffinity('koro', 4, 'asked about Hinerua');
    await say(f, [
      { who: 'mori', text: 'Koro, the carved post down at the landing. The serpent coiling up it. Who is she?', expr: 'thinking' },
      { who: 'koro', text: 'Ah. You noticed her. Good. Most people look at the river and never see who made it.', expr: 'happy' },
      { who: 'koro', text: 'That is Hinerua. Our kaitiaki. The guardian of the river, and of us.', expr: 'serious' },
      { who: 'koro', text: 'But a story like hers is not for the middle of the day, with the hens shouting. Come to the fire tonight, when it is dark. The whole village will be there.', expr: 'neutral' },
      { who: 'aroha', text: 'He tells it every year before her night. I still get goosebumps, Mori.', expr: 'happy' },
    ], true);
    startVillageQuest('v11_festival', false);
    return;
  }
  if (!vf('story')) {
    if (c.night) { await R.storyByFire(c); return; }
    const k = await say(f, [{ who: 'koro', text: 'Tonight, by the fire. Stories need the dark around them.', expr: 'neutral' }, think('Rest by the fire until dark?', ['Rest until dark', 'Later'])]);
    if (k === 0) await R.restUntil(c, 'night');
    return;
  }
  if (!vf('skinFound') && questStatus('v11_hinerua') === 'active') {
    await say(f, [{ who: 'koro', text: 'Before we go to her, find her gift. The reeds below her pou catch the skins when the river brings them down. We give a little of it back.', expr: 'neutral' }], true);
    return;
  }
  if (!vf('offering')) {
    if (c.tod !== 'day') { await R.offering(c); return; }
    const k = await say(f, [{ who: 'koro', text: 'We go to her when the sun is low, morning or evening. Not in the glare of the day, like visitors.', expr: 'neutral' }, think('Rest until evening?', ['Rest until evening', 'Later'])]);
    if (k === 0) await R.restUntil(c, 'dusk');
    return;
  }
  if (!blessed()) { await R.blessing(c); return; }
  // the everyday Koro: a menu
  const opts = ['Tell me more about Hinerua', vf('photoOk') ? 'How is the village?' : 'May I take photographs here?', 'Goodbye'];
  const k = await say(f, [think('Koro looks up from the paepae.', opts)]);
  if (k === 0) {
    await say(f, [rand.pick<BubbleLine>([
      { who: 'koro', text: 'When the river floods, she is turning over in her sleep. We move the waka up the bank and we do not complain.', expr: 'neutral' },
      { who: 'koro', text: 'Some say she has a mate who sleeps out under the sea. Who knows. Even taniwha get lonely.', expr: 'thinking' },
      { who: 'koro', text: 'The serpents here do not bite our children. We do not hunt them. That is an old agreement, older than me.', expr: 'serious' },
    ])], true);
  } else if (k === 1 && !vf('photoOk')) await askPhotos(c);
  else if (k === 1) {
    await say(f, [rand.pick<BubbleLine>([
      { who: 'koro', text: 'Our people have watched over this island for longer than anyone can count. Kaitiakitanga: we look after it, and it looks after us.', expr: 'neutral' },
      { who: 'koro', text: 'A camera that steals no feathers and takes no eggs. Good. My grandfather would have liked you, I think.', expr: 'happy' },
      { who: 'koro', text: 'Huia says you ate three bowls last night. Good. A thin man worries her.', expr: 'teasing' },
    ])], true);
  }
}
async function askPhotos(c: VCtx) {
  setVf('photoOk');
  addAffinity('koro', 4, 'asked before photographing');
  addBond('aroha', 3);
  await say(c.f, [
    { who: 'mori', text: 'Koro, may I photograph the village? The houses, the gardens... the people, if they say yes.', expr: 'neutral' },
    { who: 'koro', text: 'You asked. That is the right way round. Yes, photograph what you like outside.', expr: 'happy' },
    { who: 'koro', text: 'Not inside the wharenui: the ancestors in there did not agree to it. And ask each person yourself. Pīpī will say yes before you finish the question.', expr: 'teasing' },
  ], true);
}

// ---------------------------------------------------------------- Huia
async function talkHuia(c: VCtx) {
  const f = c.f;
  const R = await import('./chores');
  if (!vf('huiaMet')) {
    setVf('huiaMet');
    await say(f, [
      { who: 'huia', text: 'So this is the one. Let me look at you. Too thin. Sit. No, don’t sit, there’s work. Here.', expr: 'happy' },
      { who: 'mori', text: 'Kia ora, Nanny... Huia?', expr: 'surprised' },
      { who: 'huia', text: 'Everybody’s nanny. Koro’s big sister, whatever he tells you. Eat this.', expr: 'teasing' },
    ]);
    give('vil_paraoa', 1);
    game.ui.toast('Nanny Huia gave you <b>parāoa parai</b>.', 'FOOD', 'teal', 2800);
    return;
  }
  // the festival preparations
  if (questStatus('v11_festival') === 'active' && !vf('prep:kai') && count('v10_fish') + count('vil_tuna') >= 2) {
    let n = 2;
    for (const id of ['vil_tuna', 'v10_fish']) while (n > 0 && count(id) > 0) { remove(id, 1); n--; }
    setVf('prep:kai');
    addAffinity('huia', 8, 'kai for the festival');
    await say(f, [{ who: 'huia', text: 'Fish for the hāngī! Good boy. These go in the bottom basket, closest to the stones.', expr: 'happy' }]);
    return;
  }
  const opts: string[] = [];
  const acts: (() => Promise<void>)[] = [];
  if (questStatus('v11_festival') === 'active' && !vf('prep:wood')) { opts.push('Can I help with the hāngī?'); acts.push(() => say(f, [{ who: 'huia', text: 'The hāngī eats wood like your Joshu eats bread. Split some at the pile. Three good armfuls.', expr: 'neutral' }]).then(() => undefined)); }
  if (!knowsRecipe('boilup')) { opts.push('Will you teach me a dish?'); acts.push(async () => {
    teachRecipe('boilup', 'huia');
    addAffinity('huia', 5, 'learned the boil-up');
    await say(f, [{ who: 'huia', text: 'A boil-up. Fish, kūmara, a handful of greens, everything in the one pot and leave it alone. A boil-up is patience, not cleverness.', expr: 'serious' }]);
    game.ui.toast('Recipe learned: <b>Kūmara boil-up</b> (the pot).', 'RECIPE', 'teal', 3200);
  }); }
  opts.push('Something to eat?'); acts.push(async () => {
    if (game.save.vars['v11v:huiaFood'] === game.save.day) { await say(f, [{ who: 'huia', text: 'You’ve had yours today. Greedy. Come back tomorrow.', expr: 'teasing' }]); return; }
    game.save.vars['v11v:huiaFood'] = game.save.day;
    const food = c.night || c.tod === 'dusk' ? 'vil_hangi' : 'vil_paraoa';
    await R.tasteOrPack(c, food, 'huia', food === 'vil_hangi' ? 'Straight out of the ground. Careful, it’s hot.' : 'Fried bread. Golden syrup on top. Don’t tell the doctor.');
  });
  opts.push('Goodbye'); acts.push(async () => {});
  const k = await say(f, [think('Nanny Huia wipes her hands on her cardigan.', opts)]);
  await acts[k]?.();
}

// ---------------------------------------------------------------- Mere
async function talkMere(c: VCtx) {
  const f = c.f;
  if (!game.save.flags['v10:kete']) {
    game.save.flags['v10:kete'] = true;
    give('gift_kete', 1);
    addAffinity('mere', 6, 'the kete');
    await say(f, [
      { who: 'mere', text: 'So you are the scientist who carries everything in his arms. Here: a kete. Harakeke, from my own bushes. It holds more than it looks.', expr: 'teasing' },
      { who: 'mori', text: 'It’s beautiful. Thank you, Whaea.', expr: 'happy' },
    ]);
    game.ui.toast('Whaea Mere gave you a <b>woven flax bag</b>.', 'GIFT', 'teal', 3200);
    return;
  }
  const opts = ['Can I help with the flax?', 'Bread for the road?', 'Goodbye'];
  const k = await say(f, [think('Whaea Mere’s fingers never stop moving.', opts)]);
  if (k === 0) await (await import('./chores')).flaxChore(c);
  else if (k === 1) {
    if (game.save.vars['v10:bread'] === game.save.day) { await say(f, [{ who: 'mere', text: 'Bread for the road, not bread for the whole road. Tomorrow.', expr: 'teasing' }]); return; }
    game.save.vars['v10:bread'] = game.save.day;
    give('vil_rewena', 1);
    await say(f, [rand.pick<BubbleLine>([
      { who: 'mere', text: 'Bread for the road. Don’t share it with Aroha, she already had three.', expr: 'teasing' },
      { who: 'mere', text: 'Rēwena. The bug for it is older than Koro. Older than Koro’s jokes.', expr: 'happy' },
    ])]);
  } else if (k === 2) await say(f, [rand.pick<BubbleLine>([
    { who: 'mere', text: 'Cut the outer leaves, never the heart. The heart is the baby; the leaves around it are the parents. Same with people.', expr: 'serious' },
    { who: 'mere', text: 'Your translator called me “Whale Mary” this morning. Tell Jenna I want a word with her machine.', expr: 'grumpy' },
  ])]);
}

// ---------------------------------------------------------------- Tamati
async function talkTamati(c: VCtx) {
  const k = await say(c.f, [
    { who: 'tamati', text: rand.pick(['Kia ora, bro. Mind the mounds, they bruise.', 'You walk like a man who has never weeded anything.', 'Kūmara like the sun on their faces and their feet dry. Like me.']), expr: 'happy' },
    think('Tamati leans on his digging stick.', ['Can I help dig?', 'Goodbye']),
  ]);
  if (k === 0) await (await import('./chores')).digChore(c);
}

// ---------------------------------------------------------------- Manu
async function talkManu(c: VCtx) {
  const k = await say(c.f, [
    { who: 'manu', text: rand.pick(['Don’t look the big pig in the eye. She thinks it’s a challenge.', 'The rooster’s called Captain. He hates everyone. Respect.', 'Mum says I have to be polite to you. So. Hello. Politely.']), expr: 'teasing' },
    think('Manu has hay in his hair.', ['Can I help feed the animals?', 'Collect eggs with you?', 'Goodbye']),
  ]);
  const ch = await import('./chores');
  if (k === 0) await ch.feedPigs(c);
  else if (k === 1) await ch.eggChore(c);
}

// ---------------------------------------------------------------- Rāwiri
async function talkRawiri(c: VCtx) {
  const f = c.f;
  if (!game.save.flags['v10:rawiriLights']) {
    game.save.flags['v10:rawiriLights'] = true;
    rumour('coast');
    addNote({ id: 'note:lights', loc: 'village', x: 300, text: 'Rāwiri saw boat lights off the east coast. Not ours.' });
    await say(f, [
      { who: 'rawiri', text: 'Kia ora, bro. You came up the Blackwater? On foot? With the ironjaws? Respect.', expr: 'surprised' },
      { who: 'rawiri', text: 'Hey, you know who else is out here? Three nights ago I saw lights on the sea, east, past the reef. A boat. Not one of ours. Not yours either.', expr: 'serious' },
    ]);
    return;
  }
  const opts = ['Can I help with the eel traps?', !knowsRecipe('eelstew') ? 'How do you cook tuna?' : 'Any kūmara going?', 'Goodbye'];
  const k = await say(f, [think('Rāwiri is coiling a line.', opts)]);
  if (k === 0) await (await import('./chores')).hinakiChore(c);
  else if (k === 1 && !knowsRecipe('eelstew')) {
    teachRecipe('eelstew', 'rawiri');
    addAffinity('rawiri', 4, 'recipe');
    await say(f, [{ who: 'rawiri', text: 'Smoked tuna, broken up, and greens. Low heat, bro. The smoke already did the work, you just keep it company.', expr: 'happy' }]);
    game.ui.toast('Recipe learned: <b>Tuna stew</b> (the pot).', 'RECIPE', 'teal', 3200);
  } else if (k === 1) {
    give('vil_kumara', 1);
    await say(f, [rand.pick<BubbleLine>([
      { who: 'rawiri', text: 'Fish bite at the turn of the tide. The eels bite at everything. Have a kūmara.', expr: 'happy' },
      { who: 'rawiri', text: 'Take a kūmara. Aroha says you forget to eat when you are photographing. Bro. Eat.', expr: 'teasing' },
    ])]);
  }
}

// ---------------------------------------------------------------- Hēmi
async function talkHemi(c: VCtx) {
  const f = c.f;
  if (vf('festival') && !vf('hei')) {
    setVf('hei');
    give('vil_hei', 1);
    addAffinity('hemi', 10, 'the pendant');
    await say(f, [
      { who: 'hemi', text: 'Here. Don’t make a fuss. Bone, from the old whale on the point. Hinerua, coiled up asleep.', expr: 'neutral' },
      { who: 'hemi', text: 'You danced like a man falling down a hill, but you danced. So she knows you.', expr: 'teasing' },
      { who: 'mori', text: 'Uncle... thank you. I’ll wear it every day.', expr: 'happy' },
    ]);
    game.ui.toast('Uncle Hēmi gave you a <b>Hinerua pendant</b>.', 'GIFT', 'teal', 3600);
    return;
  }
  const k = await say(f, [
    { who: 'hemi', text: rand.pick(['A waka is a tree that wants to travel. I just help it.', 'Sixty days with the adze and she’ll float. Seventy if Rāwiri helps.', 'That hull was a tōtara older than my great-grandfather. We asked it first. Then we said sorry. Then we said thank you.']), expr: 'neutral' },
    think('Uncle Hēmi wipes the adze on his apron.', ['Can I try the adze?', 'Goodbye']),
  ]);
  if (k === 0) await (await import('./chores')).adzeChore(c);
}

// ---------------------------------------------------------------- Hana
async function talkHana(c: VCtx) {
  const f = c.f;
  const L = await import('./lessons');
  if (!vf('heardHana')) {
    setVf('heardHana');
    startVillageQuest('v11_huekiri', false);
    await L.listenToHana(c);
    return;
  }
  if (!vf('kiriGiven')) {
    if (count('vil_kiri') > 0) { await L.makeHueKiri(c); return; }
    await say(f, [{ who: 'hana', text: 'Bring me a skin from the reeds and I’ll make you your own. Hinerua gives them away free, but only to people who go and look.', expr: 'teasing' }]);
    return;
  }
  const opts: string[] = [];
  const acts: (() => Promise<void>)[] = [];
  opts.push('A lesson on the hue kiri'); acts.push(() => L.lesson(c));
  if (questStatus('v11_festival') === 'active' && !vf('prep:dance')) { opts.push('Teach me the serpent dance'); acts.push(() => L.dancePractice(c)); }
  else if (vf('prep:dance')) { opts.push('Practise the dance again'); acts.push(() => L.dancePractice(c)); }
  opts.push('Goodbye'); acts.push(async () => {});
  const k = await say(f, [think('Aunty Hana taps the gourd’s skin. It answers with a soft boom.', opts)]);
  await acts[k]?.();
}

// ---------------------------------------------------------------- the kids
async function talkPipi(c: VCtx, a: Actor) {
  const f = c.f;
  a.setAnim('wave');
  await say(f, [
    { who: 'pipi', text: 'Is that a CAMERA? Take my photo! Take my photo! I’m going to do my scary face!', expr: 'excited' },
    { who: 'mori', text: 'Okay, okay... say “kūmara”!', expr: 'happy' },
  ]);
  a.setAnim('angry');
  audio.play('shutter');
  game.r.post.flash = 0.3;
  await sleep(700);
  a.setAnim('laugh');
  addAffinity('pipi', 3, 'photo');
  await say(f, [{ who: 'pipi', text: rand.pick(['Was it scary? It was SO scary. Can I see? ...Aww, I look happy in it.', 'Now one of Ani! No, wait, she’ll do a better scary face. Never mind.', 'Send it to the newspaper. What’s a newspaper?']), expr: 'laugh' }]);
  a.setAnim('idle');
}
async function talkAni(c: VCtx) {
  const k = await say(c.f, [
    { who: 'ani', text: rand.pick(['Pīpī says you’re a wizard. Are you a wizard?', 'Aunty Hana says I dance like water. Pīpī dances like a goat.', 'Can you catch the rooster? Nobody can catch the rooster.']), expr: 'teasing' },
    think('Ani looks at you like she is measuring you.', ['I bet I can catch the rooster', 'Goodbye']),
  ]);
  if (k === 0) await (await import('./chores')).roosterChase(c);
}
async function talkMikaere(c: VCtx, a: Actor) {
  a.setAnim('jump');
  await say(c.f, [{ who: 'mikaere', text: rand.pick(['I’m the fastest in the whole village. Watch! ...No, you weren’t watching.', 'Did you know eels can go on land? I saw one. It looked at me.', 'I fell in the pig mud. Don’t tell Nanny.', 'When I’m big I’m going to carve a waka THIS big.']), expr: 'excited' }]);
}

const TALK: Record<string, Talk> = {
  koro: talkKoro, huia: talkHuia, mere: talkMere, tamati: talkTamati, manu: talkManu, rawiri: talkRawiri,
  hemi: talkHemi, hana: talkHana, pipi: talkPipi, ani: talkAni, mikaere: talkMikaere,
};

/** Koro's welcome the first time, and Aroha's reminders about manners */
export async function welcome(c: VCtx) {
  const k = actorOf(c, 'koro');
  if (!k) return;
  await sleep(4200);
  if (game.scene !== c.f) return;
  bark('koro', 'Haere mai, haere mai! Welcome. My moko Aroha says you are friends. Then you are friends of ours.', { expr: 'happy', clean: true });
}
export { vv, setVv };
