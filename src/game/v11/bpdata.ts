// V11 Blueprints: the sheets themselves (see ./blueprints.ts for the contract). Every blueprint's
// effect is read by gameplay through fx10 (v10/skills10.ts: the old skill tree's numbers, now coming
// from blueprints) and gearFx (v10/campgear.ts: the old bench upgrade chains, now blueprint chains).
//
// Kinds: weapon / tool (things on the belt), equipment (camera, pack, boots, swim gear, lamp),
// survival (food, water, sleep, remedies), research (know-how and lab kit from the agency's R&D),
// recipe (consumables you can make again and again), camp (camp builds).
//
// Materials only use things the island gives: the beach and the stream (wood, stone, flax, kawakawa,
// kelp, sea glass, flint, clay, feathers, shells, shore plants, berries, sand hoppers), the wreck of
// the Kittiwake (inner-tube rubber, leather from the boat bags, scrap metal: src/game/v9/forage.ts) and
// Aroha's mānuka fork.

import { defineBlueprint, BLUEPRINTS } from './blueprints';
import type { BlueprintDef } from './blueprints';
import { defineItem, ITEMS } from '../items';
import { game } from '../game';

// ---------------------------------------------------------------- new materials and makes
defineItem({ id: 'manuka_fork', name: 'Mānuka fork', kind: 'material', stack: 1, weight: 0.2, where: 'Aroha’s Lesson: the grove',
  desc: 'A forked mānuka branch, stripped and shaped by Aroha by the fire. Hard, springy, perfect for a slingshot frame.' });
defineItem({ id: 'rubber_band', name: 'Inner-tube rubber', kind: 'material', stack: 6, weight: 0.05, where: 'The wreck: the burst life ring',
  desc: 'A strip cut from the Kittiwake’s burst life ring. Black, stretchy, smells of the sea and old tyres.' });
defineItem({ id: 'leather_scrap', name: 'Leather scrap', kind: 'material', stack: 6, weight: 0.1, where: 'The wreck: the sodden boat bags',
  desc: 'A square of soft leather cut from the bottom of a ruined boat bag. Good for pouches, grips and straps.' });
if (!ITEMS.scrap?.where) { const s = ITEMS.scrap; if (s) s.where = 'The wreck: torn-off fittings'; }
defineItem({ id: 'smoke_bomb', name: 'Smoke ball', kind: 'material', stack: 4, weight: 0.15, where: 'Craft it (blueprint)',
  desc: 'Dried kawakawa and salt fern packed in clay with a flax wick. Throw it (Use, in the field) and a cloud of peppery smoke blinds whatever is coming at you.' });

// ---------------------------------------------------------------- helpers
const F = (k: string) => !!game.save.flags[k];
/** a crew bond, read from the day bucket without importing day.ts (it imports energy -> fx10 -> here) */
const bondOf = (who: 'jenna' | 'joshu' | 'aroha'): number => {
  const v = (game.save as unknown as { v10?: { day?: { bond?: Record<string, number> } } }).v10?.day?.bond;
  return v?.[who] ?? 0;
};
const B = (d: BlueprintDef) => defineBlueprint(d);

// =====================================================================================================
// WEAPONS AND TOOLS
// =====================================================================================================
B({ id: 'slingshot', name: 'Slingshot', kind: 'weapon', by: 'aroha', source: 'quest:aroha', hint: 'Aroha’s Lesson',
  desc: 'Aroha’s design: a forked mānuka frame, a band cut from the wreck’s inner tube and a leather pouch. Scares off predators.',
  effect: 'Ready it with G: a pebble on the brow sends predators packing',
  needs: [['manuka_fork', 1], ['rubber_band', 1], ['leather_scrap', 1], ['flaxleaf', 1]], out: ['slingshot', 1],
  notes: ['pull to the jaw, not the eye', 'lash it wet, it shrinks tight', 'for scaring. NOT for birds.'],
  line: 'Aroha’s design, Jenna’s glue. Point it at things that bite, not at me.' });
B({ id: 'pebble_pouch', name: 'Pebble pouch', kind: 'weapon', by: 'aroha', source: 'quest:aroha', rp: 40, hours: 8, req: ['slingshot'],
  desc: 'A drawstring pouch of leather on your belt: more pebbles before you have to scoop up a handful.',
  effect: 'Pouch holds 25 pebbles (was 15)', needs: [['leather_scrap', 2], ['flaxleaf', 1]],
  notes: ['round stones fly true', 'river stones best'], line: 'Pebble pouch! It jingles. Very sneaky. Not sneaky at all.' });
B({ id: 'smoke_bomb', name: 'Smoke balls', kind: 'weapon', by: 'aroha', source: 'quest:aroha', rp: 60, hours: 12, repeat: true,
  desc: 'Aroha’s trick: dried kawakawa and salt fern packed in a skin of clay with a flax wick. Thrown, it bursts into peppery smoke.',
  effect: 'Makes 2 smoke balls: Use one from the pack to blind a charging predator',
  needs: [['kawakawa', 2], ['plant_saltfern', 1], ['clay', 1]], out: ['smoke_bomb', 2],
  notes: ['throw upwind of it', 'never upwind of you'] });
B({ id: 'walking_staff', name: 'Mānuka walking staff', kind: 'tool', by: 'aroha', source: 'research', rp: 40, hours: 8,
  desc: 'A straight mānuka staff with a flax-bound grip and a feather on a cord. A third leg on every slope.',
  effect: 'All energy costs −15%', needs: [['wood', 2], ['flaxleaf', 1], ['feather', 1]],
  notes: ['plant it, then step', 'shoulder height'], line: 'A stick! A very good stick. Aroha says it’s a staff. It’s a stick.' });
B({ id: 'trap', name: 'Live trap', kind: 'recipe', by: 'ranger', source: 'found:ranger', hint: 'The rangers’ box by the bush track', rp: 70, hours: 20, repeat: true,
  desc: 'The island rangers’ standard live-capture box: driftwood slats, a flax trip cord and a flat stone door that drops shut. Nobody gets hurt.',
  effect: 'Makes a live trap: set it like a lure (F) and shy animals walk in for a photo',
  needs: [['wood', 3], ['flaxleaf', 2], ['stone', 1]], out: ['trap', 1],
  notes: ['CHECK TRAPS DAILY', 'release on site', 'door must drop clean'] });
B({ id: 'braided_line', name: 'Braided flax line', kind: 'equipment', by: 'joshu', source: 'quest:joshu', rp: 35, hours: 8,
  desc: 'Three-strand muka line, rolled on the thigh the old way and soaked in kelp oil. Takes a big fish’s run without snapping.',
  effect: 'Fishing line half again as hard to snap', needs: [['flaxleaf', 4], ['kelp', 1]],
  notes: ['roll on the thigh, left over right', 'oil it, it lasts'], line: 'Dad says this line could tow the Kittiwake. Dad says a lot of things.' });
B({ id: 'fishing_reel', name: 'Kittiwake reel', kind: 'equipment', by: 'joshu', source: 'found:wreck', hint: 'In the wreck: Joshu’s locker', req: ['braided_line'],
  desc: 'Joshu’s old brass reel, stripped, cleaned of sand and rebuilt with a flint pawl. A smooth drag at last.',
  effect: 'Fishing line twice as hard to snap', needs: [['scrap', 2], ['flint', 1], ['driftglass', 1]],
  notes: ['drag: two clicks, never three', 'rinse in fresh water!!'], line: 'Dad cried a bit when I told him I fixed the reel. Manly tears. Fish tears.' });
B({ id: 'storm_lantern', name: 'Storm lantern', kind: 'tool', by: 'whaler', source: 'found:cave', hint: 'Somewhere dark in the sea cave',
  desc: 'An old whaler’s lantern design: a sea-glass chimney in a driftwood cage. Burns kelp oil and never blows out.',
  effect: 'A brighter, longer headlamp beam; walking after dark costs less', needs: [['driftglass', 3], ['wood', 2], ['kelp', 2]],
  notes: ['the wick low in a gale', 'trim daily'] });

// =====================================================================================================
// CAMERA EQUIPMENT (the old Camera skills and the bench's camera-body chain)
// =====================================================================================================
B({ id: 'tripod', name: 'Driftwood tripod', kind: 'equipment', by: 'jenna', source: 'research', rp: 40, hours: 8,
  desc: 'Three driftwood legs lashed at the top with a flat stone for a head. Brace the camera and the steadiness ring fills sooner.',
  effect: 'Capture hold 5 s → 4 s', needs: [['wood', 3], ['flaxleaf', 1], ['stone', 1]],
  notes: ['legs 1 m, splay 25°', 'stone head = no wobble (mostly)'], line: 'Tripod! It’s three sticks and a rock. It is also a miracle of engineering.' });
B({ id: 'film_satchel', name: 'Film satchel', kind: 'equipment', by: 'jenna', source: 'research', rp: 70, hours: 12,
  desc: 'A waxed satchel of spare film cartridges, sealed with kelp and lined with leather. Dry even in the rain.',
  effect: '+8 shots per trip', needs: [['kelp', 2], ['leather_scrap', 1]],
  notes: ['8 cartridges', 'KEEP DRY'], line: 'Film satchel. Eight more shots of Chunk. I mean of science.' });
B({ id: 'developer_kit', name: 'Film developer kit', kind: 'equipment', by: 'jenna', source: 'research', rp: 80, hours: 12,
  desc: 'A warm-pocket developer flask of clay and sea glass, with a pinch of salt-fern crystals to speed the chemistry.',
  effect: 'Photos develop in 12 s (was 20 s)', needs: [['clay', 1], ['driftglass', 2], ['plant_saltfern', 1]],
  notes: ['keep at body heat', '12 s, not 13'], line: 'Developer kit. Keep it in your inside pocket. Not THAT inside pocket.' });
B({ id: 'telephoto_lens', name: 'Telephoto lens', kind: 'equipment', by: 'jenna', source: 'research', rp: 130, hours: 24, req: ['film_satchel'],
  desc: 'The long lens from the Kittiwake’s locker, its cracked element replaced with ground opal shell. Frame shy animals from far away.',
  effect: 'Zoom ×3.4 · +4 shots', needs: [['driftglass', 4], ['shell_opal', 1], ['scrap', 1]],
  notes: ['f/5.6 at best', 'opal element: don’t ask'] });
B({ id: 'gimbal', name: 'Stabiliser gimbal', kind: 'equipment', by: 'jenna', source: 'research', rp: 150, hours: 24, req: ['tripod', 'developer_kit'],
  desc: 'A hand gimbal: a weighted stone pendulum on a rubber-damped scrap-metal yoke. Hands shake less and slow panning keeps the ring filling.',
  effect: 'Shake −40% · hold 3 s · track slowly', needs: [['wood', 2], ['stone', 2], ['scrap', 1], ['rubber_band', 1]],
  notes: ['counterweight LOW', 'rubber dampers x4'] });
B({ id: 'video_rig', name: 'Video rig', kind: 'equipment', by: 'jenna', source: 'research', rp: 110, hours: 24, req: ['developer_kit'],
  desc: 'Jenna’s firmware hack plus a fanshell microphone baffle. Record behaviour as video: some findings can only be proven on film.',
  effect: 'Record clips (V)', needs: [['driftglass', 1], ['scrap', 1], ['shell_fan', 1]],
  notes: ['REC = hold V', 'fanshell = wind muffler!!'] });
B({ id: 'instant_film', name: 'Instant film back', kind: 'equipment', by: 'agency', source: 'research', rp: 280, hours: 48, req: ['gimbal'],
  desc: 'The agency’s fast instant stock and a hair-trigger back. The shot is in, dry and in your pocket while the animal is still there.',
  effect: 'Photos develop in 5 s · hold → 2 s', needs: [['driftglass', 2], ['clay', 2], ['shell_opal', 1]],
  notes: ['ISO 1600', 'ZEA PROPERTY'] });
// the camera body chain (gearFx: captureHoldCut, developMult, idBonus)
B({ id: 'lens_hood', name: 'Lens hood & glass kit', kind: 'equipment', by: 'jenna', source: 'research', rp: 20, hours: 8, chain: ['camera', 1],
  desc: 'A hood cut from a bait tin and a polishing kit made from tumbled sea glass and kelp cloth.',
  effect: 'Research photos lock on half a second sooner; sharper in glare', needs: [['driftglass', 3], ['kelp', 1]],
  notes: ['bait tin, ex-sardines', 'polish in circles'], line: 'Hood: bait tin. Cloth: kelp. Smell: also kelp. You’re welcome.' });
B({ id: 'sealed_body', name: 'Weather-sealed body', kind: 'equipment', by: 'jenna', source: 'research', rp: 40, hours: 12, chain: ['camera', 2], req: ['lens_hood'],
  desc: 'Every seam of the camera packed with river clay and flint-dust resin; the battery door finally shuts.',
  effect: 'Photos develop faster; rain and spray stop fogging the lens', needs: [['clay', 2], ['flint', 2]],
  notes: ['all 14 seams', 'battery door: CLAY, not hope'], line: 'Sealed it up tight. You can drop it in a rock pool now. Please do not drop it in a rock pool.' });
B({ id: 'fast_firmware', name: 'Fast-shutter firmware', kind: 'research', by: 'jenna', source: 'research', rp: 80, hours: 24, chain: ['camera', 3], req: ['sealed_body'],
  desc: 'Jenna rewrote the camera’s firmware on the laptop. It says JENNA OS when it boots.',
  effect: 'Locks on a full second sooner; more of a moving animal stays sharp', needs: [['driftglass', 4], ['shell_opal', 1]],
  notes: ['v0.9.3-jenna', 'do NOT update'], line: 'If it says “hello, nature boy” when you switch it on, that is a feature.' });

// =====================================================================================================
// FIELD EQUIPMENT (the old Field skills and the bench's pack, boots, swim and lamp chains)
// =====================================================================================================
B({ id: 'climbing_gloves', name: 'Grip gloves', kind: 'equipment', by: 'jenna', source: 'quest:jenna', rp: 80, hours: 12,
  desc: 'Leather palms faced with kelp rubber and flint grit. They bite on wet rock and pull water like paddles.',
  effect: 'Climbing & swimming −35% energy', needs: [['leather_scrap', 2], ['kelp', 2], ['flint', 1]],
  notes: ['grit on the palms only', 'webbing: optional, dorky'], line: 'Grip gloves. High five! Ow. Okay, they work.' });
B({ id: 'waterproof_pack', name: 'Dry-bag pack liner', kind: 'equipment', by: 'jenna', source: 'research', rp: 70, hours: 12,
  desc: 'A kelp-and-clay sealed liner with a rubber roll-top. Heavy things low and close; nothing gets wet.',
  effect: '+4 kg capacity · +3 pockets', needs: [['kelp', 4], ['clay', 1], ['rubber_band', 1]],
  notes: ['roll 3 times, clip', 'heavy = low'] });
B({ id: 'expedition_frame', name: 'Expedition frame', kind: 'equipment', by: 'agency', source: 'research', rp: 240, hours: 48, req: ['waterproof_pack', 'frame_pack'],
  desc: 'The agency’s proper expedition frame: a load-lifter yoke on a bent driftwood frame with leather hip pads. Carry much more, feel it much less.',
  effect: '+8 kg · +3 pockets · heavy loads slow you less · +10 max energy', needs: [['wood', 4], ['flaxleaf', 3], ['leather_scrap', 2]],
  notes: ['hip belt takes 80%', 'ZEA SPEC 7'] });
B({ id: 'canteen', name: 'Clay canteen', kind: 'survival', by: 'joshu', source: 'quest:joshu', rp: 50, hours: 8,
  desc: 'A fired-clay water bottle in a leather sling, stoppered with a whittled plug. A long drink whenever you need it.',
  effect: '+10 max energy', needs: [['clay', 2], ['leather_scrap', 1]],
  notes: ['fire it slow, or it cracks', 'sip, don’t gulp'], line: 'A canteen! Dad says drink before you’re thirsty. Dad also says that about tea.' });
B({ id: 'remedy_kit', name: 'Remedy kit', kind: 'survival', by: 'village', source: 'quest:village', rp: 90, hours: 12,
  desc: 'Kawakawa leaves for the stomach, sea-holly for the fever and burnt-clay charcoal to soak up the poison. Bad forage hurts half as much.',
  effect: 'Poison −50%', needs: [['kawakawa', 3], ['plant_seaholly', 1], ['clay', 1]],
  notes: ['chew kawakawa, swallow the juice', 'charcoal: 1 spoon'] });
B({ id: 'smoker', name: 'Fish smoker', kind: 'survival', by: 'joshu', source: 'quest:joshu', rp: 60, hours: 12,
  desc: 'Joshu’s stone smoke box beside the fire: fish and berries smoked over mānuka keep longer and go further.',
  effect: 'Food restores 20% more energy', needs: [['stone', 4], ['wood', 3], ['flaxleaf', 2]],
  notes: ['mānuka chips, low smoke', '4 hours, not 5'], line: 'Dad’s smoker. Everything tastes like campfire now. Even the tea. ESPECIALLY the tea.' });
B({ id: 'shelter', name: 'Thatched lean-to', kind: 'camp', by: 'village', source: 'quest:village', rp: 80, hours: 24,
  desc: 'A flax-thatched lean-to over the tent, the village way: rain runs off, the wind goes round. You sleep dry and wake ready.',
  effect: '+10 max energy (you sleep better)', needs: [['flaxleaf', 6], ['wood', 4], ['clay', 2]],
  notes: ['thatch down-slope', 'ridge to the wind'] });
B({ id: 'rain_catcher', name: 'Rain catcher', kind: 'camp', by: 'village', source: 'quest:village', rp: 50, hours: 12,
  desc: 'A flax gutter off the lean-to into a clay-lined pit. Fresh water every morning: you set out properly hydrated.',
  effect: 'All energy costs −5%', needs: [['wood', 2], ['kelp', 3], ['clay', 2]],
  notes: ['gutter: 1 in 20', 'cover the pit at night'] });
// the pack chain (gearFx.packBonus)
B({ id: 'flax_straps', name: 'Flax-cord straps', kind: 'equipment', by: 'aroha', source: 'quest:aroha', rp: 10, hours: 8, chain: ['pack', 1],
  desc: 'New pack straps of twisted harakeke, lashed Aroha’s way.',
  effect: '+3 kg comfortable load', needs: [['flaxleaf', 4], ['kelp', 2]],
  notes: ['over, under, around, pull'], line: 'Straps by Aroha’s method. Over, under, around, pull tight. Do not tell her I needed three goes.' });
B({ id: 'kelp_pockets', name: 'Kelp-leather side pockets', kind: 'equipment', by: 'jenna', source: 'research', rp: 30, hours: 8, chain: ['pack', 2], req: ['flax_straps'],
  desc: 'Dried kelp, cured hard as leather, stitched on with feather-quill awls.',
  effect: '+6 kg comfortable load in all', needs: [['kelp', 6], ['feather', 2]],
  notes: ['pocket L: SNACKS', 'pocket R: also SNACKS'], line: 'Side pockets! One is labelled SNACKS. The other is also labelled SNACKS.' });
B({ id: 'frame_pack', name: 'Driftwood frame pack', kind: 'equipment', by: 'jenna', source: 'research', rp: 60, hours: 12, chain: ['pack', 3], req: ['kelp_pockets'],
  desc: 'A bent driftwood frame that puts the weight on your hips.',
  effect: '+10 kg comfortable load in all', needs: [['wood', 4], ['flaxleaf', 3], ['stone', 2]],
  notes: ['steam-bend the bow', 'hips, not shoulders'], line: 'Your back will thank me. Your back will write me a poem.' });
// the boots chain (gearFx.energyMult, climbSpeed, climbEnergyMult; the trail boots also run lighter)
B({ id: 'kelp_soles', name: 'Kelp-rubber soles', kind: 'equipment', by: 'jenna', source: 'research', rp: 15, hours: 8, chain: ['boots', 1],
  desc: 'Dried kelp, layered and glued with clay under the worn-out soles.',
  effect: 'Walking costs 7% less energy', needs: [['kelp', 3], ['clay', 1]],
  notes: ['3 layers', 'they squeak'], line: 'Kelp soles. They squeak. You will learn to love the squeak.' });
B({ id: 'grip_soles', name: 'Grip soles', kind: 'equipment', by: 'jenna', source: 'research', rp: 35, hours: 8, chain: ['boots', 2], req: ['kelp_soles'],
  desc: 'Flint chips pressed into the soles: they bite on wet rock.',
  effect: 'Climbing is faster; walking costs 14% less energy', needs: [['flint', 2], ['kelp', 3]],
  notes: ['chips point BACK'], line: 'You could walk up a waterfall in these. Do not walk up a waterfall in these.' });
B({ id: 'trail_boots', name: 'Trail boots', kind: 'equipment', by: 'joshu', source: 'research', rp: 70, hours: 24, chain: ['boots', 3], req: ['grip_soles'],
  desc: 'Joshu’s spare deck boots, cut down and padded with feathers. Light enough to run in.',
  effect: 'Walking & climbing −20% energy · sprinting −40%, 8% faster', needs: [['feather', 4], ['clay', 2], ['leather_scrap', 1]],
  notes: ['size 9 (yours: 8)', 'feathers in the toe'], line: 'Dad’s spare boots. He says if you get them wet he will know. He will know.' });
// the swim chain (gearFx.swim, swimEnergyMult)
B({ id: 'snorkel', name: 'Snorkel & mask', kind: 'equipment', by: 'jenna', source: 'research', rp: 20, hours: 8, chain: ['wetsuit', 1],
  desc: 'A dive mask from the Kittiwake’s locker with a new sea-glass faceplate.',
  effect: 'Look underwater while swimming; swimming −15% energy', needs: [['driftglass', 2], ['kelp', 2]],
  notes: ['spit in it. seriously.'], line: 'Mask, fixed. Snorkel, fixed. The snorkel tastes like Dad. I am so sorry.' });
B({ id: 'wetsuit', name: 'Patched wetsuit', kind: 'equipment', by: 'jenna', source: 'research', rp: 45, hours: 12, chain: ['wetsuit', 2], req: ['snorkel'],
  gate: () => (F('v10:agency') ? null : 'Needs the agency’s patch kit (radio the field office first)'),
  desc: 'A torn wetsuit from the wreck, patched with kelp and sealed with clay and inner-tube rubber.',
  effect: 'Cold water is fine; swimming −30% energy', needs: [['kelp', 6], ['clay', 2], ['rubber_band', 1]],
  notes: ['more patch than suit'], line: 'It has more patches than suit. It is a patchsuit. Wear it with pride.' });
B({ id: 'fins', name: 'Fins', kind: 'equipment', by: 'jenna', source: 'research', rp: 80, hours: 24, chain: ['wetsuit', 3], req: ['wetsuit'],
  desc: 'Two fanshell-stiffened fins cut from the tender’s rubber floor.',
  effect: 'Swim faster; swimming −40% energy', needs: [['shell_fan', 3], ['kelp', 4], ['rubber_band', 2]],
  notes: ['kick from the hip'], line: 'Fins! You look like a very confused duck. A FAST confused duck.' });
// the headlamp chain
B({ id: 'lamp_lens', name: 'Sea-glass lamp lens', kind: 'equipment', by: 'jenna', source: 'research', rp: 15, hours: 8, chain: ['headlamp', 1],
  desc: 'A polished sea-glass lens that throws the headlamp’s beam twice as far.',
  effect: 'A brighter, longer beam in caves and after dark', needs: [['driftglass', 2]],
  notes: ['don’t look into it'], line: 'Brighter beam. Do not look into it. I looked into it. I can see sounds now.' });
B({ id: 'solar_battery', name: 'Solar battery', kind: 'equipment', by: 'jenna', source: 'research', rp: 35, hours: 12, chain: ['headlamp', 2], req: ['lamp_lens'],
  desc: 'A cell from the boat’s solar panel, charged at camp every day.',
  effect: 'The beam never flickers; night walks cost 15% less energy', needs: [['shell_opal', 1], ['flint', 2], ['scrap', 1]],
  notes: ['charge: breakfast to lunch'], line: 'Solar battery. It charges on the panel while you eat breakfast. Eat a long breakfast.' });
// the translator chain (story-gated)
B({ id: 'phrasebook', name: 'Phrasebook patch', kind: 'research', by: 'aroha', source: 'research', rp: 25, hours: 12, chain: ['translator', 1],
  gate: () => (!F('v10:translator1') ? 'Jenna has to finish building the translator first' : bondOf('aroha') < 20 ? 'Needs a closer friendship with Aroha' : null),
  desc: 'Aroha read a hundred words into the laptop; Jenna fed them to the translator.',
  effect: 'Fewer mistranslations (translator level 2)', needs: [['feather', 2]],
  notes: ['kia ora · kai · Chunk, no'], line: 'It now knows “kia ora”, “kai” and “Chunk, no”. Very important words.' });
B({ id: 'voice_pack', name: 'Te reo voice pack', kind: 'research', by: 'aroha', source: 'research', rp: 60, hours: 24, chain: ['translator', 2], req: ['phrasebook'],
  gate: () => (bondOf('aroha') < 45 ? 'Needs a closer friendship with Aroha' : null),
  desc: 'Hours of Aroha’s stories, recorded round the fire. The app finally listens.',
  effect: 'Hardly any mistranslations (translator level 3)', needs: [['plant_saltfern', 1], ['driftglass', 2]],
  notes: ['her grandmother’s stories'], line: 'It translated Aroha’s joke and I laughed. A COMPUTER made me laugh at a JOKE. In ANOTHER LANGUAGE.' });

// =====================================================================================================
// RESEARCH TECHNOLOGY (the old Data Analysis and Research skills)
// =====================================================================================================
B({ id: 'field_notebook', name: 'Field notes protocol', kind: 'research', by: 'agency', source: 'research', rp: 40, hours: 8,
  desc: 'The agency’s field-notes protocol: date, place, weather, behaviour, with every photo. Each upload fills in more of a research sheet.',
  effect: 'Research sheets: 3 sections per upload', notes: ['DATE · PLACE · WX · BEHAV'] });
B({ id: 'foodweb_map', name: 'Food-web mapping', kind: 'research', by: 'mori', source: 'research', rp: 80, hours: 12, req: ['field_notebook'],
  desc: 'Pins and string on the tent wall: who eats whom, who pollinates what, who lives in whose burrow. Uploads draw the links between species.',
  effect: 'Reveal ecosystem links', notes: ['red string = eats', 'green = pollinates'] });
B({ id: 'grant_writing', name: 'Grant writing', kind: 'research', by: 'agency', source: 'research', rp: 90, hours: 12, req: ['field_notebook'],
  desc: 'Same data, better story: the agency’s template for reports that read well. They pay more for them.',
  effect: '+15% RP from the agency', notes: ['use the word “novel”'] });
B({ id: 'ethogram', name: 'Behaviour statistics', kind: 'research', by: 'agency', source: 'research', rp: 150, hours: 24, req: ['foodweb_map'],
  desc: 'An ethogram sheet and a stopwatch: count it, time it, chart it. Behaviour photos are worth a star more and sheets open further.',
  effect: 'Sheets: 4 sections · behaviour shots +1 star', notes: ['tally every 30 s'] });
B({ id: 'survey_kit', name: 'Survey kit', kind: 'research', by: 'ranger', source: 'research', rp: 140, hours: 24, req: ['grant_writing'],
  desc: 'A flax transect tape knotted every metre and a driftwood quadrat. Places, ruins, fossils and samples are worth half as much again.',
  effect: 'Discoveries +50% RP', needs: [['flaxleaf', 3], ['wood', 2]], notes: ['knot every 1 m', 'quadrat 50 cm'] });
B({ id: 'eco_model', name: 'Ecosystem model', kind: 'research', by: 'agency', source: 'research', rp: 300, hours: 48, req: ['ethogram', 'survey_kit'],
  desc: 'Everything you have recorded in one model of the island. A new upload reveals its whole research sheet.',
  effect: 'Whole sheets at once · +15% RP', notes: ['ZEA MODEL v2'] });
B({ id: 'hand_lens', name: 'Sea-glass hand lens', kind: 'research', by: 'mori', source: 'research', rp: 40, hours: 8,
  desc: 'A ground sea-glass loupe on a cord. You know the shapes now: a slightly soft, small or half-hidden animal can still be identified.',
  effect: 'Identify blurrier, smaller animals', needs: [['driftglass', 2]], notes: ['×6, roughly'] });
B({ id: 'autotag', name: 'Auto-tag script', kind: 'research', by: 'jenna', source: 'research', rp: 80, hours: 12, req: ['hand_lens'],
  desc: 'A little script of Jenna’s that boxes and names every identifiable animal in an upload for you.',
  effect: 'Uploads tag animals automatically', notes: ['autotag.py', 'do NOT read the comments'] });
B({ id: 'reagent_kit', name: 'Quick-assay reagent kit', kind: 'research', by: 'agency', source: 'research', rp: 70, hours: 12, req: ['hand_lens'],
  desc: 'Pre-mixed reagents in clay vials and a routine. Samples go through the laptop much faster.',
  effect: 'Sample analysis 40% faster', needs: [['plant_saltfern', 1], ['clay', 1]], notes: ['A → B → shake → wait'] });
B({ id: 'field_microscope', name: 'Field microscope', kind: 'research', by: 'agency', source: 'research', rp: 160, hours: 24, req: ['autotag'],
  desc: 'A folding field microscope with an opal-shell mirror. Spot patterns, scale rows and wing bars match even on a blurry, tiny or mostly hidden animal.',
  effect: 'Identify from much worse photos', needs: [['driftglass', 3], ['shell_opal', 1], ['scrap', 1]], notes: ['×40 / ×100', 'mirror to the sun'] });
B({ id: 'plant_press', name: 'Botanist’s plant press', kind: 'research', by: 'village', source: 'research', rp: 120, hours: 24, req: ['reagent_kit'],
  desc: 'Two driftwood boards and flax ties: press a leaf, learn its shape. You can tell safe forage from poisonous on sight (mushrooms still need the lab).',
  effect: 'Know safe plants & berries on sight', needs: [['wood', 2], ['flaxleaf', 2]], notes: ['press 3 days', 'smell it first'] });
B({ id: 'pocket_sequencer', name: 'Pocket Sequencer', kind: 'research', by: 'agency', source: 'research', rp: 260, hours: 48, req: ['field_microscope', 'plant_press'],
  desc: 'Sequence DNA from a scrap of tissue. Faster analysis, more from every sample, and mushrooms identified too.',
  effect: 'Analysis 2× faster · samples +25% RP · mushrooms known', needs: [['scrap', 2], ['driftglass', 2], ['shell_opal', 1]],
  notes: ['ZEA-SEQ mk.II', 'keep dry · keep warm'] });

// =====================================================================================================
// RECIPES (consumables, made again and again)
// =====================================================================================================
B({ id: 'fruit_lure', name: 'Fruit lure', kind: 'recipe', by: 'village', source: 'research', rp: 25, hours: 8, repeat: true,
  desc: 'Mashed goldcurrants and kawakawa in a leaf parcel. Fruit- and nectar-eaters can’t resist it.',
  effect: 'Makes 2 fruit lures (set one with F on an expedition)', needs: [['berry_gold', 2], ['kawakawa', 1]], out: ['fruitlure', 2],
  notes: ['ripe ones!', 'tie with flax'] });
B({ id: 'grub_lure', name: 'Hopper lure', kind: 'recipe', by: 'joshu', source: 'research', rp: 30, hours: 8, repeat: true,
  desc: 'A driftwood cage of live sand hoppers. Insect-eaters come to see what all the boinging is about.',
  effect: 'Makes a grub lure', needs: [['bug_sandhopper', 2], ['wood', 1]], out: ['grublure', 1], notes: ['keep them damp'] });
B({ id: 'glow_lure', name: 'Glow lure', kind: 'recipe', by: 'village', source: 'research', rp: 45, hours: 12, repeat: true,
  desc: 'Glow moss in a kelp lantern. Night insects (and whatever eats them) come to the light.',
  effect: 'Makes a glow lure', needs: [['plant_glowmoss', 2], ['kelp', 1]], out: ['glowlure', 1], notes: ['at dusk only'] });

/** old skill-tree skills -> the blueprint that now does the same thing (save migration and fx10) */
export const SKILL_TO_BP: Record<string, string> = {
  cam_grip: 'tripod', cam_film: 'film_satchel', cam_dev1: 'developer_kit', cam_zoom: 'telephoto_lens', cam_stab: 'gimbal', cam_video: 'video_rig', cam_instant: 'instant_film',
  data_notes: 'field_notebook', data_web: 'foodweb_map', data_grant: 'grant_writing', data_ethology: 'ethogram', data_survey: 'survey_kit', data_model: 'eco_model',
  res_eye: 'hand_lens', res_tag: 'autotag', res_assay: 'reagent_kit', res_match: 'field_microscope', res_botany: 'plant_press', res_lab: 'pocket_sequencer',
  fld_legs: 'walking_staff', fld_pack: 'waterproof_pack', fld_climb: 'climbing_gloves', fld_sprint: 'trail_boots', fld_gut: 'remedy_kit', fld_frame: 'expedition_frame',
};

/** the gear chains in order (campgear.ts gearLevel counts the built steps) */
const chainCache = new Map<string, { n: number; ids: string[] }>();
export function CHAIN_STEPS(chain: string): string[] {
  const n = Object.keys(BLUEPRINTS).length, hit = chainCache.get(chain);
  if (hit && hit.n === n) return hit.ids;
  const ids = Object.values(BLUEPRINTS).filter(b => b.chain?.[0] === chain).sort((a, b) => a.chain![1] - b.chain![1]).map(b => b.id);
  chainCache.set(chain, { n, ids });
  return ids;
}
