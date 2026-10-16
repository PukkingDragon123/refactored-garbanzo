// V11 NPCs: the side quests. Each new person has at least one; most are several steps long and use
// the game's own mechanics (the slingshot, photography and the research log, finds and carrying
// things home, cooking, the camp, the map). They are ordinary quests (src/game/quests.ts: the HUD
// tracks them, they complete on their own and pay RP and items); this module adds what the quest
// system doesn't do: affinity, recipes (teachRecipe), blueprints (grantBlueprint), and the
// conversation-menu entries to offer, hand in and finish them.
//
//   q_roof    Hine     Raise the Roof: wood and rope for the station; knock the radio out of the tree
//                      with the slingshot; Jenna fixes it at camp; give it back. Trail markers blueprint
//   q_birds   Doug     Birds of a Feather: document three new bird species. Doug's compote recipe and
//                      the birding scope blueprint
//   q_junior  Rosie    Junior Ranger: three seashells for her collection, then she meets Chunk at camp.
//                      Her hand-made badge
//   q_tags    Celeste  The Yellow Tags: find the Helix camp, free three animals from Helix live traps,
//                      then convince Dr Varga (she listens to people she respects). Sampling kit blueprint
//   q_home    Teo      A Taste of Home: bring homesick Teo something sweet. His skillet bread recipe
//   q_traps   Rua      The Trap Line: set three tunnel traps on the ridge, check them after a night,
//                      report back. Box trap blueprint
//   q_cans    Sunny    Tin Can Alley: knock her three cans off the log with the slingshot. Her bush
//                      boil-up recipe and a full pouch of pebbles
//   q_timber  Tīpene   The Right Timber: cut a block from a fallen tōtara in Fernwood, bring it to him at
//                      camp, come back for the paddle he carves. Carved handles blueprint
//   q_nets    Ngaio    Nets and Harakeke: old fishing net from the shore and flax leaves; she weaves a
//                      kete. Woven pouch blueprint
//   q_pages   Marge    The Scattered Sketchbook: four pages the storm blew along the home shore. Her
//                      mussel skewers and the plant press blueprint

import { game } from '../../game';
import { QUESTS, QUEST_BY_ID, questStatus, startQuest } from '../../quests';
import type { QuestDef, QuestStep, Giver } from '../../quests';
import { ITEMS, defineItem } from '../../items';
import { count, remove, give } from '../../inventory';
import { SPECIES_BY_ID } from '../../species';
import { addAffinity, affinity, tier, hasMet, PEOPLE } from '../social';
import { defineBlueprint, grantBlueprint, hasBlueprint } from '../blueprints';
import { RECIPES, RECIPE_BY_ID, teachRecipe, knowsRecipe } from '../cooking';
import type { Recipe } from '../cooking';
import { defineFood } from '../../v10/forage10';
import { registerNpcItemArt } from '../../../art/v11/npcs/items';
import { F, setF, V, setV, day } from './state';
import type { MenuOpt, TalkHost, Line } from './types';
import { L } from './types';

// ---------------------------------------------------------------- things
const item = (id: string, name: string, kind: 'key' | 'material' | 'food', desc: string, o: { stack?: number; weight?: number; where?: string; energy?: number } = {}) => {
  if (!ITEMS[id]) defineItem({ id, name, kind, stack: o.stack ?? 1, desc, weight: o.weight, where: o.where, energy: o.energy, eat: kind === 'food' ? 'energy' : undefined });
};
item('q_radio', 'The station radio', 'key', 'Te Puni station’s radio, cracked by the storm and wound in tape. It spent a week up a tree.', { weight: 1.5, where: 'Up a tree by the ranger station' });
item('q_radio_fixed', 'The station radio (fixed)', 'key', 'Jenna’s repair: a new aerial, a dry board and her initials scratched inside the case.', { weight: 1.5 });
item('q_page', 'Sketchbook page', 'key', 'A page from Marge’s sketchbook: pencil drawings of beetles, ferns and one very cross bird.', { stack: 4, where: 'Blown along the home shore' });
item('q_totara', 'Tōtara block', 'material', 'A block of red tōtara from a tree that fell years ago. Heavy, straight-grained, and it smells like a pencil.', { weight: 4, where: 'A fallen tōtara in Fernwood' });
item('q_net', 'Old fishing net', 'material', 'A tangle of blue nylon net the sea gave back. Ngaio can work it into harakeke.', { stack: 4, weight: 0.4, where: 'Washed up on the home shore' });
item('q_badge', 'Junior Ranger badge', 'key', 'A gold star cut from a tin lid on a green ribbon. “J.R. MORI. HONORY.” Spelling by Rosie.');
item('q_paddle', 'Carved paddle', 'key', 'Tīpene’s hoe, carved from your tōtara: a leaf blade with a koru at the throat. For the tender, when she floats.', { weight: 2 });
item('q_kete', 'Net-and-flax kete', 'key', 'Ngaio’s weaving: harakeke with a band of blue fishing net, two plaited handles. Strong enough to carry stones.', { weight: 0.3 });
item('dish_flatbread', 'Skillet bread', 'food', 'Teo’s nervous baking: golden, soft inside, crusty outside. Tastes like somebody’s kitchen far away.', { stack: 4, weight: 0.2, energy: 26, where: 'Cooked at the fire' });
item('dish_boilup', 'Bush boil-up', 'food', 'Sunny’s family pot: fish, kūmara and greens boiled together until the broth is the best part.', { stack: 2, weight: 0.6, energy: 46, where: 'Cooked at the fire' });
defineFood('dish_flatbread', { energy: 26 });
defineFood('dish_boilup', { energy: 46 });
registerNpcItemArt();

// ---------------------------------------------------------------- recipes the new people teach
const addRecipe = (r: Recipe) => { if (!RECIPE_BY_ID[r.id]) { RECIPES.push(r); RECIPE_BY_ID[r.id] = r; } };
addRecipe({ id: 'flatbread', name: 'Skillet bread', method: 'pan', needs: [{ tag: 'starch', n: 2 }], dish: 'dish_flatbread', portions: 2, time: 9, heat: [0.4, 0.7],
  teach: { who: 'teo', line: 'Mash anything starchy, press it flat, hot pan, don’t touch it until it lets go by itself. That’s the whole secret. Patience. I don’t have any. The bread does.' }, hint: 'Two starchy things, pressed flat on a hot pan.' });
addRecipe({ id: 'boilup', name: 'Bush boil-up', method: 'pot', needs: [{ tag: 'fish', n: 1 }, { tag: 'starch', n: 1 }, { tag: 'herb', n: 1 }], dish: 'dish_boilup', portions: 2, time: 15, heat: [0.5, 0.8],
  teach: { who: 'sunny', line: 'Fish, kūmara, greens, all in one pot, and you boil it till the broth tastes like home. My mum’s recipe. Tell anyone and she’ll find you.' }, hint: 'A fish, something starchy and a peppery green, boiled together.' });
// two old recipes get teachers
const giveTeacher = (id: string, who: string, line: string) => { const r = RECIPE_BY_ID[id]; if (r && !r.teach) r.teach = { who, line }; };
giveTeacher('compote', 'doug', 'Moonfruit and berries, low heat, keep it moving. Hine says I put compote on everything. I say everything deserves compote.');
giveTeacher('skewers', 'marge', 'Mussels on a green stick, over the coals until they open. I lived on these my whole first year. Delicious every single time.');

// ---------------------------------------------------------------- blueprints earned from people
const bp = (id: string, name: string, kind: Parameters<typeof defineBlueprint>[0]['kind'], desc: string, who: string) => defineBlueprint({ id, name, kind, desc, source: 'quest:' + who });
bp('trail_markers', 'Trail markers', 'tool', 'Hine’s reflective ribbons on wire ties: mark the way in and you always find the way home. The walk back costs less.', 'hine');
bp('birding_scope', 'Birding scope', 'research', 'Doug’s old spotting scope rebuilt: a steady eye on a far branch. Photographs of distant birds come out sharper.', 'doug');
bp('sample_kit', 'Non-invasive sampling kit', 'research', 'Swabs, shed-skin envelopes and a hair tape: DNA without a trap. Helix’s new protocol, and now yours.', 'celeste');
bp('box_trap', 'Tunnel trap', 'camp', 'Rua’s design: a wooden tunnel with a treadle, for stoats and rats. Set at camp, it keeps the larder and the dune burrows safe.', 'rua');
bp('carved_handles', 'Carved tool handles', 'tool', 'Tīpene’s handles: tōtara shaped to your grip. Tools work faster and last longer.', 'tipene');
bp('woven_pouch', 'Woven side pouch', 'equipment', 'Ngaio’s harakeke-and-net pouch for the pack: a little more room for the things you can’t leave behind.', 'ngaio');
bp('plant_press', 'Plant press', 'research', 'Marge’s press: two boards, straps and blotting paper. Pressed plant samples are worth more research.', 'marge');

// ---------------------------------------------------------------- the quest book
export interface NpcQuest {
  id: string;
  giver: string;
  /** who offers it, if not the giver (Teo asks for help with Dr Varga's traps) */
  by?: string;
  title: string;
  desc: string;
  unlock: () => boolean;
  /** the offer (ends with the giver's ask; choices are added) */
  ask: Line[];
  /** after "yes" */
  yes: Line[];
  steps: QuestStep[];
  reward: { rp?: number; items?: [string, number][]; text: string };
  /** snapshot counters when accepted */
  onAccept?: () => void;
  /** conversation-menu entries while it's active (hand-ins, the final step) */
  actions?: (who: string) => MenuOpt[];
}
const birdsIn = () => Object.keys(game.save.research ?? {}).filter(id => SPECIES_BY_ID[id]?.group === 'Bird').length;
const shellsIn = () => game.save.inv.filter(s => ITEMS[s.id]?.kind === 'shell').reduce((a, s) => a + s.n, 0);
const prog = (n: number, of: number): [number, number] => [Math.min(of, n), of];
const has = (id: string, n = 1) => count(id) >= n;
/** a step: hand things over to someone (done once handed in) */
const handStep = (flag: string, text: string, need: [string, number][], hint?: string): QuestStep => ({
  text, hint, done: () => F(flag), progress: need.length === 1 ? () => (F(flag) ? [need[0][1], need[0][1]] : prog(count(need[0][0]), need[0][1])) : undefined,
});
const takeAll = (need: [string, number][]) => { if (need.some(([id, n]) => count(id) < n)) return false; for (const [id, n] of need) remove(id, n); (game.scene as unknown as { hud?: { refresh(f?: boolean): void } } | null)?.hud?.refresh(true); return true; };

/** say a few lines; a reward toast; persist */
async function payout(h: TalkHost, o: { who: string; aff?: [string, number][]; recipe?: string; blueprint?: string; items?: [string, number][]; toast: string }) {
  for (const [id, n] of o.aff ?? []) addAffinity(id, n, 'quest');
  for (const [id, n] of o.items ?? []) give(id, n);
  let extra = '';
  if (o.recipe && teachRecipe(o.recipe, o.who)) extra += ` Recipe learned: <b>${RECIPE_BY_ID[o.recipe]?.name}</b>.`;
  if (o.blueprint && grantBlueprint(o.blueprint, 'quest:' + o.who)) extra += ` New blueprint: <b>${o.blueprint.replace(/_/g, ' ')}</b>.`;
  game.ui.toast(o.toast + extra, 'FRIEND', 'teal', 5200);
  game.persist();
  void h;
}

export const NPC_QUESTS: NpcQuest[] = [
  // ================================================================ Hine: Raise the Roof
  {
    id: 'q_roof', giver: 'hine', title: 'Raise the Roof',
    desc: 'The storm took the ranger station’s roof and threw its radio up a tree. Hine needs timber and rope for the roof, and the radio back, working.',
    unlock: () => hasMet('hine'),
    ask: [['hine', 'Since you’re standing there looking useful. I need four good lengths of wood and two rope for the roof frame.', 'neutral'], ['hine', 'And the radio. It’s in that tree. The tall one. Right at the top. I am not climbing it and Doug is not allowed to.', 'grumpy']],
    yes: [['hine', 'Good lad. Wood and rope first. The radio... you’ll think of something. Aroha says you’ve got a slingshot now.', 'happy']],
    steps: [
      handStep('q_roof:given', 'Bring Hine 4 wood and 2 rope for the roof', [['wood', 4], ['rope', 2]], 'Driftwood above the tide line, rope twisted from flax at Jenna’s bench.'),
      { text: 'Knock the station radio out of the tall tree', done: () => F('q_roof:down'), hint: 'Stand under the tall tree beside the station, ready the slingshot (G) and aim high. No slingshot? You can always throw stones.' },
      { text: 'Pick up the radio', done: () => F('q_roof:got') },
      { text: 'Ask Jenna to fix the radio at camp', done: () => F('q_roof:fixed'), hint: 'Bring it home in your pack. Jenna can fix anything with tape and swearing.' },
      { text: 'Give the radio back to Hine', done: () => F('q_roof:returned') },
    ],
    reward: { rp: 40, items: [['ration', 2]], text: 'The station has a roof and a radio again.' },
    actions: () => {
      const out: MenuOpt[] = [];
      if (!F('q_roof:given') && has('wood', 4) && has('rope', 2)) out.push({ label: 'Here: four lengths of wood and two rope.', quest: true, run: async h => {
        if (!takeAll([['wood', 4], ['rope', 2]])) return;
        setF('q_roof:given');
        addAffinity('hine', 4, 'quest');
        await h.say(L([['hine', 'That’s the frame sorted. Doug! Hammer! ...No, the OTHER hammer.', 'happy'], ['hine', 'Now. The radio. Top of the tall tree. Off you go.', 'teasing']]));
      } });
      if (F('q_roof:fixed') && !F('q_roof:returned') && has('q_radio_fixed')) out.push({ label: 'Jenna fixed your radio.', quest: true, run: async h => {
        remove('q_radio_fixed', 1);
        setF('q_roof:returned');
        await h.say(L([
          ['hine', 'Is that... it’s got a light. It’s got a LIGHT, Doug!', 'surprised'],
          ['hine', '*kssht* Te Puni to District, Te Puni to District. ...We’re all right. We’re all right. And we’ve got company.', 'happy'],
          ['hine', 'Thank you, Mori. Here. Trail markers, my own pattern. Tie them in as you go and you’ll always find the way home.', 'happy'],
        ]));
        await payout(h, { who: 'hine', aff: [['hine', 15], ['doug', 6], ['rosie', 4]], blueprint: 'trail_markers', toast: 'Hine is grateful.' });
      } });
      return out;
    },
  },
  // ================================================================ Doug: Birds of a Feather
  {
    id: 'q_birds', giver: 'doug', title: 'Birds of a Feather',
    desc: 'Doug has been birding this coast for twenty-four years and he still hasn’t seen everything. Document three bird species new to your research log.',
    unlock: () => hasMet('doug') && tier('doug') >= 1,
    ask: [['doug', 'Mori. A proposition. You’ve got a camera that can see a feather from a mile off. I’ve got a list of birds I’ve never seen properly.', 'excited'], ['doug', 'Three new birds. Photographed, uploaded, in the log. And I’ll teach you my one recipe. It’s compote. It’s a good compote.', 'happy']],
    yes: [['doug', 'Brilliant! Ridges and canopy, that’s where they hide. Quiet feet. Patience. And for heaven’s sake don’t sing. That’s my job.', 'excited']],
    onAccept: () => setV('q_birds:base', birdsIn()),
    steps: [
      { text: 'Document 3 bird species new to your research log', done: () => birdsIn() - V('q_birds:base') >= 3, progress: () => prog(birdsIn() - V('q_birds:base'), 3), hint: 'Photograph birds and upload the photos at the laptop. The canopy, the falls and the coast are full of them.' },
      { text: 'Tell Doug about the birds', done: () => F('q_birds:told') },
    ],
    reward: { rp: 45, text: 'Three new birds in Doug’s life list.' },
    actions: () => (birdsIn() - V('q_birds:base') >= 3 && !F('q_birds:told') ? [{ label: 'I’ve got your three birds.', quest: true, run: async h => {
      setF('q_birds:told');
      await h.say(L([['doug', 'Show me. Show me show me show me. ...Oh. OH. Look at the crest on that one. Hine! HINE! He’s got the crested one!', 'excited'], ['doug', 'A deal is a deal. Moonfruit, berries, low heat, and patience. And my old scope. You’ll get more use out of it than me.', 'happy']]));
      await payout(h, { who: 'doug', aff: [['doug', 15]], recipe: 'compote', blueprint: 'birding_scope', toast: 'Doug is over the moon.' });
    } }] : []),
  },
  // ================================================================ Rosie: Junior Ranger
  {
    id: 'q_junior', giver: 'rosie', title: 'Junior Ranger',
    desc: 'Rosie wants three seashells for her collection and, more than anything in the world, to meet Chunk.',
    unlock: () => hasMet('rosie'),
    ask: [['rosie', 'Mori. I have a mission for you. A ranger mission. Are you ready? You have to say ready.', 'serious'], ['mori', 'Ready.', 'determined'], ['rosie', 'I need three shells for my collection. Different ones. And then. AND THEN. You have to let me meet Chunk.', 'excited']],
    yes: [['rosie', 'YES! Mum! MUM! Mori’s doing my mission!', 'excited']],
    steps: [
      handStep('q_junior:given', 'Bring Rosie 3 seashells', [], 'Shells wash up all along the home shore. Look in the rock pools.'),
      { text: 'Let Rosie meet Chunk at camp', done: () => F('q_junior:chunk'), hint: 'Rosie will come down to camp in the morning, once she has her shells.' },
    ],
    reward: { rp: 20, text: 'Mori is an honorary Junior Ranger.' },
    actions: () => (!F('q_junior:given') && shellsIn() >= 3 ? [{ label: 'Three shells for your collection.', quest: true, run: async h => {
      let n = 3;
      for (const s of [...game.save.inv]) { if (n <= 0) break; if (ITEMS[s.id]?.kind !== 'shell') continue; const k = Math.min(n, s.n); remove(s.id, k); n -= k; }
      setF('q_junior:given');
      setV('q_junior:day', day());
      addAffinity('rosie', 6, 'quest');
      await h.say(L([['rosie', 'They’re PERFECT. This one’s going in the good box. This one’s going in the VERY good box.', 'excited'], ['rosie', 'Tomorrow morning I’m coming to your camp. Mum said yes. Tell Chunk. Tell him to be ready.', 'happy']]));
    } }] : []),
  },
  // ================================================================ Celeste & Teo: The Yellow Tags
  {
    id: 'q_tags', giver: 'celeste', by: 'teo', title: 'The Yellow Tags',
    desc: 'Helix sets live traps all over the island to collect samples, and not every animal in them gets checked in time. Free the animals you find in them, then make Dr Varga see it.',
    unlock: () => hasMet('teo'),
    ask: [['teo', 'Mori. Can I tell you something? Off the record? Dr Varga’s traps. The live ones. We set too many. I can’t check them all.', 'worried'], ['teo', 'If you find one of our yellow traps out there with something in it... let it go? Please? And then maybe... talk to her. She doesn’t listen to me.', 'sad']],
    yes: [['teo', 'Thank you. Really. They’re yellow, they have a tag with a number. You can’t miss them. I’m terrible at hiding things.', 'happy']],
    steps: [
      { text: 'Free 3 animals from Helix live traps', done: () => V('q_tags:freed') >= 3, progress: () => prog(V('q_tags:freed'), 3), hint: 'The yellow traps are along the Serpent Coast, in Fernwood and the mangroves.' },
      { text: 'Make Dr Varga see what her traps are doing', done: () => F('q_tags:turned'), hint: 'She’ll only listen to someone she respects: get to know her first (talk, gifts), and bring Teo along by being his friend too.' },
    ],
    reward: { rp: 60, text: 'Helix changes its sampling protocol.' },
    actions: () => (V('q_tags:freed') >= 3 && !F('q_tags:turned') ? [{ label: 'Dr Varga. About your traps.', quest: true, run: async h => {
      if (h.id !== 'celeste') { await h.say(L([['teo', 'You let them all go? Mori. You have to tell HER. I’ll back you up. I’ll... stand behind you. Quite far behind you.', 'worried']])); return; }
      const respect = affinity('celeste') + (tier('teo') >= 1 ? 12 : 0);
      await h.say(L([['mori', 'Three animals in your traps this week, half-starved. A shieldback, a delver, a little quillhog. I let them go.', 'serious'], ['celeste', 'You interfered with a Helix survey.', 'angry']]));
      if (respect < 24) {
        await h.say(L([['celeste', 'I don’t take ethics lessons from a castaway with a pug, Dr Mori. Come back with data. Not feelings.', 'grumpy'], ['mori', '(She isn’t ready to hear it from me. Maybe if she knew me better.)', 'thinking']]));
        return;
      }
      await h.say(L([
        ['mori', 'You did your doctorate on cave frogs. Four years in the dark. Would you have put them in a box and left them there?', 'serious'],
        ['celeste', '...', 'sad'],
        ['celeste', 'No. No, I wouldn’t have.', 'sad'],
        ['celeste', 'Teo. TEO. Pull the traps. All of them. We sample non-invasively from now on. Swabs, shed skin, photographs.', 'serious'],
        ['teo', 'Yes, Dr Varga! Right away! *trying very hard not to smile*', 'happy'],
        ['celeste', 'Here. The kit specification. If we’re going to do this properly, so should you. ...Thank you, Mori.', 'neutral'],
      ]));
      setF('q_tags:turned');
      await payout(h, { who: 'celeste', aff: [['celeste', 12], ['teo', 12], ['hine', 6]], blueprint: 'sample_kit', toast: 'Helix will sample without traps from now on.' });
    } }] : []),
  },
  // ================================================================ Teo: A Taste of Home
  {
    id: 'q_home', giver: 'teo', title: 'A Taste of Home',
    desc: 'Teo is homesick for his mother’s cinnamon buns and a frozen lake. Bring him something sweet cooked over a fire: berry porridge or moonfruit compote.',
    unlock: () => hasMet('teo') && tier('teo') >= 1,
    ask: [['teo', 'Can I ask you something weird? Do you ever cook anything... sweet? Out here? I keep dreaming about my mum’s buns. The cinnamon ones.', 'sad'], ['teo', 'Not that you have to. I just. Something sweet. That somebody made. Would be nice.', 'happy']],
    yes: [['teo', 'Really? You’d do that? I’ll... I’ll teach you my skillet bread. It’s the only thing I can make that isn’t from a packet.', 'happy']],
    steps: [
      { text: 'Bring Teo a berry porridge or a moonfruit compote', done: () => F('q_home:given'), hint: 'Cook it at the camp fire: biscuits and berries in the pot, or moonfruit and berries in the pan.' },
    ],
    reward: { rp: 25, text: 'Teo feels a bit less far from home.' },
    actions: () => {
      const dish = ['dish_porridge', 'dish_compote'].find(d => has(d));
      return dish && !F('q_home:given') ? [{ label: `I made you ${ITEMS[dish].name.toLowerCase()}.`, quest: true, run: async h => {
        remove(dish, 1);
        setF('q_home:given');
        await h.say(L([['teo', 'You made this? For me? ...It’s warm. Oh no, I’m going to get emotional about porridge.', 'happy'], ['teo', '...It’s really good. It tastes like somebody’s kitchen. Here, my bread. Press it flat and don’t touch it. That’s all there is.', 'happy']]));
        await payout(h, { who: 'teo', aff: [['teo', 14]], recipe: 'flatbread', toast: 'Teo is touched.' });
      } }] : [];
    },
  },
  // ================================================================ Rua: The Trap Line
  {
    id: 'q_traps', giver: 'rua', title: 'The Trap Line',
    desc: 'Stoats came ashore with the whalers and they eat the ground birds’ eggs. Set three tunnel traps on Rua’s line in the hills, check them after a night, and tell him what you caught.',
    unlock: () => hasMet('rua'),
    ask: [['rua', 'Got a new line to set on the ridge. Three traps. My knees say no.', 'neutral'], ['rua', 'You set them. Like you forgot them there, remember. Come back after a night and check.', 'serious']],
    yes: [['rua', 'Stakes are marked with red flax. Bait’s in the box. Don’t touch it with bare hands, they’ll smell you.', 'serious']],
    steps: [
      { text: 'Set 3 tunnel traps at the marked stakes on the ridge', done: () => V('q_traps:set') >= 3, progress: () => prog(V('q_traps:set'), 3), hint: 'Red flax ties on stakes near the trappers’ camp in the Rocky Hills.' },
      { text: 'Check the traps after a night', done: () => F('q_traps:checked'), hint: 'Come back another day and look in each trap.' },
      { text: 'Tell Rua what you caught', done: () => F('q_traps:told') },
    ],
    reward: { rp: 40, items: [['trap', 2]], text: 'Two stoats off the ridge before the nesting season.' },
    onAccept: () => setV('q_traps:set', 0),
    actions: () => (F('q_traps:checked') && !F('q_traps:told') ? [{ label: 'Two stoats in your traps.', quest: true, run: async h => {
      setF('q_traps:told');
      await h.say(L([['rua', 'Two. Good. That’s a lot of eggs that hatch.', 'happy'], ['rua', 'Take the plans. Build one for your camp. Your dog won’t thank you, but the burrows on your beach will.', 'neutral'], ['sunny', 'He LIKES you. That’s what that face means. I’ve known him six years, that’s the face.', 'laugh']]));
      await payout(h, { who: 'rua', aff: [['rua', 15], ['sunny', 5]], blueprint: 'box_trap', toast: 'Rua nods. That’s a lot, from Rua.' });
    } }] : []),
  },
  // ================================================================ Sunny: Tin Can Alley
  {
    id: 'q_cans', giver: 'sunny', title: 'Tin Can Alley',
    desc: 'Sunny bets you can’t knock her three tin cans off the log at the trappers’ camp. Prove her wrong (with a slingshot, or stones if you must).',
    unlock: () => hasMet('sunny'),
    ask: [['sunny', 'Okay. Bet. Three cans on that log. You knock all three off, I teach you my mum’s boil-up and fill your pebble pouch.', 'smug'], ['sunny', 'You miss, you do the dishes for a week. For me AND Rua. Rua uses a lot of dishes.', 'laugh']],
    yes: [['sunny', 'HA! He’s in! Rua, he’s in! Go on then, big shot.', 'excited']],
    steps: [
      { text: 'Knock Sunny’s 3 cans off the log', done: () => V('q_cans:hit') >= 3, progress: () => prog(V('q_cans:hit'), 3), hint: 'The log at the trappers’ camp. Ready the slingshot (G) and aim; or throw stones by the log.' },
      { text: 'Collect your winnings from Sunny', done: () => F('q_cans:paid') },
    ],
    reward: { rp: 25, text: 'Sunny paid up. Mostly in teasing.' },
    onAccept: () => setV('q_cans:hit', 0),
    actions: () => (V('q_cans:hit') >= 3 && !F('q_cans:paid') ? [{ label: 'Three cans. Pay up.', quest: true, run: async h => {
      setF('q_cans:paid');
      game.save.vars['v11:pebbles'] = 15;
      await h.say(L([['sunny', 'Lucky. LUCKY. ...Fine. Okay. Not bad. Not BAD, Mori.', 'smug'], ['sunny', 'Boil-up: fish, kūmara, greens, one pot. And here, a pouch of the good round stones. Don’t waste them on cans. Waste them on me.', 'teasing']]));
      await payout(h, { who: 'sunny', aff: [['sunny', 12]], recipe: 'boilup', toast: 'Sunny is impressed (she will deny it).' });
    } }] : []),
  },
  // ================================================================ Tīpene: The Right Timber
  {
    id: 'q_timber', giver: 'tipene', title: 'The Right Timber',
    desc: 'Tīpene will carve a paddle for the Kittiwake’s tender, but only from the right wood: a block of tōtara from a tree that fell on its own, in Fernwood. Then give him a day.',
    unlock: () => hasMet('tipene'),
    ask: [['tipene', 'Your skipper’s boat will need a paddle. Every boat needs a paddle for the day the engine sulks.', 'thinking'], ['tipene', 'Bring me tōtara. Not cut, mind: fallen. There’s an old one down in Fernwood, lying across the stream. It’s been waiting for someone.', 'serious']],
    yes: [['tipene', 'Ask the tree before you cut it. It won’t answer. Ask anyway.', 'happy']],
    steps: [
      { text: 'Cut a block from the fallen tōtara in Fernwood', done: () => F('q_timber:given') || has('q_totara'), hint: 'In Fernwood, where the fallen tree lies across the stream.' },
      { text: 'Bring the tōtara to Tīpene at camp', done: () => F('q_timber:given'), hint: 'He comes down to the camp every few days.' },
      { text: 'Give Tīpene a day to carve, then collect the paddle', done: () => F('q_timber:done'), hint: 'He’ll be back at camp in a day or two.' },
    ],
    reward: { rp: 40, text: 'A carved paddle for the tender.' },
    actions: () => {
      const out: MenuOpt[] = [];
      if (!F('q_timber:given') && has('q_totara')) out.push({ label: 'The tōtara, from Fernwood.', quest: true, run: async h => {
        remove('q_totara', 1);
        setF('q_timber:given'); setV('q_timber:day', day());
        addAffinity('tipene', 5, 'quest');
        await h.say(L([['tipene', 'Ahh. Smell that. Like a pencil and a forest at once. She’s got a paddle in her, this one. I can see it.', 'happy'], ['tipene', 'Give me a day. Old hands, slow chisel.', 'neutral']]));
      } });
      if (F('q_timber:given') && !F('q_timber:done') && day() > V('q_timber:day')) out.push({ label: 'Is the paddle ready?', quest: true, run: async h => {
        setF('q_timber:done');
        await h.say(L([['tipene', 'Here she is. A leaf blade, a koru at the throat so she remembers where she grew. Feel the balance.', 'happy'], ['tipene', 'And take this too: how I shape a handle. Your tools will thank you.', 'neutral']]));
        await payout(h, { who: 'tipene', aff: [['tipene', 15]], items: [['q_paddle', 1]], blueprint: 'carved_handles', toast: 'A paddle carved by a master.' });
      } });
      return out;
    },
  },
  // ================================================================ Ngaio: Nets and Harakeke
  {
    id: 'q_nets', giver: 'ngaio', title: 'Nets and Harakeke',
    desc: 'Ngaio wants old fishing net from the home shore and long flax leaves, to weave you a kete that will outlast your boots.',
    unlock: () => hasMet('ngaio'),
    ask: [['ngaio', 'Okay, I have an idea and you’re going to love it. A kete for you. Harakeke, with a band of that blue net woven through.', 'excited'], ['ngaio', 'Bring me two lots of old net off your beach, and six flax leaves. Long ones. Cut low. I’ll know if you didn’t.', 'teasing']],
    yes: [['ngaio', 'Yesss. Net, flax, Ngaio. Ngaio, kete, Mori. It’s the circle of life.', 'happy']],
    steps: [
      { text: 'Collect 2 old fishing nets on the home shore', done: () => F('q_nets:given') || has('q_net', 2), progress: () => (F('q_nets:given') ? [2, 2] : prog(count('q_net'), 2)), hint: 'Snagged on the rocks by the wreck and at Seal Rocks.' },
      { text: 'Collect 6 flax leaves', done: () => F('q_nets:given') || has('flaxleaf', 6), progress: () => (F('q_nets:given') ? [6, 6] : prog(count('flaxleaf'), 6)), hint: 'Cut them from the outside of a flax bush with your knife.' },
      { text: 'Bring them to Ngaio at camp', done: () => F('q_nets:given'), hint: 'She drops by the camp every few days.' },
      { text: 'Come back for the kete', done: () => F('q_nets:done'), hint: 'Weaving takes a day.' },
    ],
    reward: { rp: 35, text: 'A kete woven just for you.' },
    actions: () => {
      const out: MenuOpt[] = [];
      if (!F('q_nets:given') && has('q_net', 2) && has('flaxleaf', 6)) out.push({ label: 'Net and flax, as ordered.', quest: true, run: async h => {
        if (!takeAll([['q_net', 2], ['flaxleaf', 6]])) return;
        setF('q_nets:given'); setV('q_nets:day', day());
        addAffinity('ngaio', 5, 'quest');
        await h.say(L([['ngaio', 'Ooh, cut low. Good boy. ...Good scientist. Sorry. I talk to my flax like that.', 'laugh'], ['ngaio', 'Tomorrow. Weaving takes as long as it takes, and it takes a day.', 'happy']]));
      } });
      if (F('q_nets:given') && !F('q_nets:done') && day() > V('q_nets:day')) out.push({ label: 'How’s the kete coming along?', quest: true, run: async h => {
        setF('q_nets:done');
        await h.say(L([['ngaio', 'Ta-da. Harakeke and net, plaited handles. It’ll carry rocks. It’ll carry Chunk, probably. Don’t carry Chunk in it.', 'excited'], ['ngaio', 'And here’s the pattern for a side pouch, so your pack stops looking like a burst pillow.', 'teasing']]));
        await payout(h, { who: 'ngaio', aff: [['ngaio', 15]], items: [['q_kete', 1]], blueprint: 'woven_pouch', toast: 'A kete woven for you.' });
      } });
      return out;
    },
  },
  // ================================================================ Marge: The Scattered Sketchbook
  {
    id: 'q_pages', giver: 'marge', title: 'The Scattered Sketchbook',
    desc: 'The storm tore four pages out of Marge’s sketchbook and blew them along the home shore. Eleven years of drawings; she wants them back.',
    unlock: () => hasMet('marge'),
    ask: [['marge', 'The storm, the wretched storm, took four pages of my sketchbook right out of my hands. Eleven years of beetles!', 'sad'], ['marge', 'They’ll have blown along the shore. West to the wreck, east to the cove. Would you keep an eye out, dear boy?', 'worried']],
    yes: [['marge', 'Oh, you are kind. Look low, under the driftwood. Paper hides like a crab.', 'happy']],
    steps: [
      { text: 'Find Marge’s 4 sketchbook pages along the home shore', done: () => F('q_pages:given') || has('q_page', 4), progress: () => (F('q_pages:given') ? [4, 4] : prog(count('q_page'), 4)), hint: 'From the wreck in the west to the cove in the east. They glint like anything else.' },
      { text: 'Bring the pages back to Marge', done: () => F('q_pages:given') },
    ],
    reward: { rp: 35, text: 'Marge’s sketchbook is whole again.' },
    actions: () => (!F('q_pages:given') && has('q_page', 4) ? [{ label: 'Your four pages.', quest: true, run: async h => {
      remove('q_page', 4);
      setF('q_pages:given');
      await h.say(L([['marge', 'My beetles! And the cross bird! Oh, and here’s the fern I never finished. I shall finish it tonight.', 'excited'], ['marge', 'Let me teach you my mussel skewers. And take my old press: a pressed plant tells you more than a photograph. Don’t tell your camera I said so.', 'happy']]));
      await payout(h, { who: 'marge', aff: [['marge', 15]], recipe: 'skewers', blueprint: 'plant_press', toast: 'Marge is delighted.' });
    } }] : []),
  },
];
export const NPC_QUEST_BY_ID: Record<string, NpcQuest> = Object.fromEntries(NPC_QUESTS.map(q => [q.id, q]));
/** which quests each person is involved in (Teo helps with Celeste's) */
const INVOLVED: Record<string, string[]> = { teo: ['q_tags'] };

function toQuest(q: NpcQuest): QuestDef {
  return { id: q.id, title: q.title, giver: q.giver as Giver, main: false, desc: q.desc, steps: q.steps, reward: { rp: q.reward.rp, items: q.reward.items, text: q.reward.text } };
}
let registered = false;
export function registerNpcQuests() {
  if (registered) return;
  registered = true;
  for (const q of NPC_QUESTS.map(toQuest)) {
    if (QUEST_BY_ID[q.id]) continue;
    QUESTS.push(q);
    QUEST_BY_ID[q.id] = q;
  }
}

/** a quest this person could offer now */
export function offerFor(who: string): NpcQuest | null {
  return NPC_QUESTS.find(q => (q.by ?? q.giver) === who && questStatus(q.id) === 'hidden' && safe(q.unlock)) ?? null;
}
const safe = (f: () => boolean) => { try { return f(); } catch { return false; } };
/** the conversation-menu entries for someone: quest actions first, then an offer */
export function questMenu(who: string): MenuOpt[] {
  const out: MenuOpt[] = [];
  for (const q of NPC_QUESTS) {
    if (questStatus(q.id) !== 'active') continue;
    if (q.giver !== who && !(INVOLVED[who] ?? []).includes(q.id)) continue;
    try { out.push(...(q.actions?.(who) ?? [])); } catch (e) { console.error(e); }
  }
  const off = offerFor(who);
  if (off) out.push({ label: 'Need a hand with anything?', quest: true, run: h => offer(h, off) });
  return out;
}
/** the offer conversation: yes starts the quest (and pins a quest note), no is fine */
export async function offer(h: TalkHost, q: NpcQuest) {
  const ask = L(q.ask);
  ask[ask.length - 1] = { ...ask[ask.length - 1], choices: ['I’m on it.', 'Not right now.'] };
  const c = await h.say(ask);
  if (c !== 0) { await h.say(L([[h.id, h.id === 'rosie' ? 'Okay. But it’s a VERY important mission.' : PEOPLE[h.id]?.id === 'rua' ? 'Mm.' : 'No worries. The offer stands.', 'neutral']])); return; }
  q.onAccept?.();
  startQuest(q.id);
  game.save.tracked = q.id;
  game.persist();
  await h.say(L(q.yes));
  void import('../../../ui/v11/social').then(m => m.questNote(q.id)).catch(e => console.warn('[npcs] quest note', e));
}

/** the yellow sample tag (from the rival event) can go back to Helix for a little goodwill */
export function tagMenu(who: string): MenuOpt[] {
  if ((who !== 'celeste' && who !== 'teo') || !has('art_tag') || F('n:tagBack')) return [];
  return [{ label: 'I think this tag is yours.', run: async h => {
    remove('art_tag', 1);
    setF('n:tagBack');
    addAffinity(who, 5, 'tag');
    await h.say(L(who === 'teo'
      ? [['teo', 'Sample 0417! I thought a bird took it. A bird DID take it? And you took it from the bird? Thanks, Mori.', 'happy']]
      : [['celeste', 'Sample 0417. Teo said he lost it. Teo loses everything except his boots. ...Thank you.', 'neutral']]));
  } }];
}
export { hasBlueprint, knowsRecipe };
