// V10 expedition finds: the new items (taonga and other artifacts, fossils, rock / soil / water
// samples, plant and fungus samples, gifts from the village, Joshu's lost things) with weights and lab
// text, and the discovery points placed in the existing places (the island shore and the V2 sites).
// The V10 sites carry their own points (src/game/sites10/*). Item id prefixes follow the research
// crate's rules (src/game/v9/research9.ts): art_ = artifact, taonga_ = Māori taonga (documented, kept
// safe, returned to the village), fos_ = fossil; samples are materials with lab text; plants/fungi are flora.

import { defineItem } from '../items';
import type { Point10 } from '../sites10/kit';
import { PixelBuffer } from '../../art/pixel';
import { hex, mix, shade } from '../../art/color';
import { Rng } from '../../core/math';
import type { Sprite } from '../../art/jungle-core';

// ------------------------------------------------------------------ taonga (returned to Te Kāinga)
defineItem({ id: 'taonga_toggle', name: 'Pounamu toggle', kind: 'key', stack: 1, weight: 0.1, where: 'Sea Grotto',
  desc: 'A greenstone cloak toggle carved like a curled hook, its cord long rotted away. Lost in the cave a very long time ago. It belongs to somebody’s family.',
  lab: { rp: 30, time: 6, text: 'Pounamu (nephrite jade), hand-ground with sandstone and water; the drill hole is worn smooth by a cord. Aroha says such toggles fastened a cloak at the shoulder, and are handed down. Keep it safe for the village.' } });
defineItem({ id: 'taonga_toki', name: 'Stone toki', kind: 'key', stack: 1, weight: 1.2, where: 'Emerald Canopy',
  desc: 'A polished basalt adze head wedged deep in a kauri’s roots, high in the canopy. Someone climbed up here to work, long ago.',
  lab: { rp: 28, time: 6, text: 'Fine-grained basalt, flaked, hammer-dressed and ground to an edge still sharp enough to shave wood. The lashing groove is worn. A woodworker’s toki: the canoes of Te Kāinga were made with tools like it.' } });
defineItem({ id: 'taonga_matau', name: 'Bone matau', kind: 'key', stack: 1, weight: 0.05, where: 'Blackwater Mangroves',
  desc: 'A fishhook carved from bone, pale and smooth, found in the mud of the channel bank.',
  lab: { rp: 24, time: 5, text: 'Carved from a single piece of serpent rib: the barb points inward so a fish cannot shake it. Hooks like this are lucky; whoever lost it will want it back.' } });
// ------------------------------------------------------------------ other artifacts
defineItem({ id: 'art_bottle', name: 'Message in a bottle', kind: 'key', stack: 1, weight: 0.4, where: 'Washed up',
  desc: 'A thick green bottle, corked and waxed. Inside, a rolled letter dated 1912: “To whoever finds this: the serpents are real. Tell my wife I was right.”',
  lab: { rp: 18, time: 4, text: 'Hand-blown glass with a pontil scar, sealed with ship’s wax. The letter is signed “E. Halvorsen, SS Maud’s Hope”. Somebody else reached this coast a century ago.' } });
defineItem({ id: 'art_tag', name: 'Helix sample tag', kind: 'key', stack: 1, weight: 0.02, where: 'Beside strange boot prints',
  desc: 'A yellow plastic tag on a zip tie: HELIX BIOPROSPECTING · SAMPLE 0417 · DO NOT REMOVE. Brand new.',
  lab: { rp: 14, time: 3, text: 'UV-stable polymer, printed last year. The barcode points to a private bioprospecting company. Somebody else is collecting on this island, and they did not come to say hello.' } });
defineItem({ id: 'art_glyphrub', name: 'Rubbing of a carving', kind: 'key', stack: 1, weight: 0.05, where: 'The Old Pā',
  desc: 'Charcoal on notebook paper: a legged serpent coiled around a hole, and lines spiralling down into it.',
  lab: { rp: 20, time: 4, text: 'The carving at the old pā shows a taniwha guarding a great hollow in the earth. The spiral matches the shape of the land to the south-east. The carvers knew a place nobody goes.' } });
// ------------------------------------------------------------------ fossils
defineItem({ id: 'fos_vertebra', name: 'Fossil serpent vertebra', kind: 'animal', stack: 3, weight: 1.8, where: 'Bone Cliffs',
  desc: 'A stone vertebra as big as a bread loaf, from a serpent far longer than any alive today.',
  lab: { rp: 26, time: 6, text: 'Mineralised bone in mudstone, some 60 million years old. The joint surfaces show this serpent had limbs: Zealandia’s serpents have walked for a very long time.' } });
defineItem({ id: 'fos_ammonite', name: 'Ammonite', kind: 'animal', stack: 4, weight: 0.6, where: 'Bone Cliffs',
  desc: 'A coiled shell turned to stone, ribbed like a ram’s horn.',
  lab: { rp: 16, time: 4, text: 'A marine ammonite: these cliffs were once the floor of a warm sea. The tooth marks on the shell are serpent marks: even then they hunted here.' } });
defineItem({ id: 'fos_leaf', name: 'Fossil fern imprint', kind: 'animal', stack: 4, weight: 0.5, where: 'Bone Cliffs, the Old Pā',
  desc: 'A slab of siltstone with the perfect print of a fern frond.',
  lab: { rp: 14, time: 3, text: 'The same tree ferns that grow in Fernwood today, preserved in stone. The forests here have barely changed in fifty million years.' } });
defineItem({ id: 'fos_tooth', name: 'Fossil serpent tooth', kind: 'animal', stack: 4, weight: 0.2, where: 'Te Korokoro',
  desc: 'A black, curved tooth as long as your hand, still sharp.',
  lab: { rp: 30, time: 6, text: 'Far larger than a Titan Constrictor’s. A grooved fang: venomous. Whatever this belonged to was bigger than anything we have photographed.' } });
defineItem({ id: 'fos_shell', name: 'Fossil scallop', kind: 'animal', stack: 5, weight: 0.3, where: 'Sea Grotto',
  desc: 'A ribbed scallop shell set in the cave’s limestone.',
  lab: { rp: 10, time: 3, text: 'The limestone of the grotto is made of shells like this, laid down in a shallow sea and lifted up by the land.' } });
// ------------------------------------------------------------------ samples (rock, soil, water)
defineItem({ id: 'smp_limestone', name: 'Cave limestone sample', kind: 'material', stack: 6, weight: 0.5, where: 'Sea Grotto',
  desc: 'A chip of pale, soft rock from the grotto wall. Fizzes with vinegar.',
  lab: { rp: 8, time: 3, text: 'Calcium carbonate full of tiny shell fragments: the cave was dissolved out of an old seabed by rain and the tide.' } });
defineItem({ id: 'smp_cavewater', name: 'Cave water sample', kind: 'material', stack: 6, weight: 0.4, where: 'Sea Grotto',
  desc: 'A jar of clear water from the cave lake. Tastes faintly salty.',
  lab: { rp: 9, time: 3, text: 'Brackish: fresh water floats over sea water that seeps in under the headland. The glowworms only live where the air above it stays still and damp.' } });
defineItem({ id: 'smp_soil', name: 'Forest soil core', kind: 'material', stack: 6, weight: 0.4, where: 'Fernwood Floor',
  desc: 'A tube of dark, crumbly soil with fine white threads running through it.',
  lab: { rp: 8, time: 3, text: 'Rich humus laced with fungal threads that connect the roots of the trees: the whole forest floor is one network.' } });
defineItem({ id: 'smp_mud', name: 'Black mud sample', kind: 'material', stack: 6, weight: 0.5, where: 'Blackwater Mangroves',
  desc: 'Sticky black mud that smells of rotten eggs.',
  lab: { rp: 8, time: 3, text: 'Oxygen-free mud full of sulphur bacteria. The mangrove roots breathe through little snorkels for a reason.' } });
defineItem({ id: 'smp_falls', name: 'River water sample', kind: 'material', stack: 6, weight: 0.4, where: 'Thunder Falls',
  desc: 'Ice-cold water from the plunge pool, with a fleck of gold mica.',
  lab: { rp: 7, time: 2, text: 'Very clean, very cold, full of dissolved oxygen: the dippers’ larvae need water just like this.' } });
defineItem({ id: 'smp_ash', name: 'Volcanic soil sample', kind: 'material', stack: 6, weight: 0.5, where: 'The Hot Valley',
  desc: 'Warm, rust-red soil, gritty with pumice.',
  lab: { rp: 10, time: 3, text: 'Weathered volcanic ash, rich in iron. The ground in the valley is still being cooked from below.' } });
defineItem({ id: 'smp_hotwater', name: 'Hot spring water', kind: 'material', stack: 6, weight: 0.4, where: 'The Hot Valley',
  desc: 'A jar of water too hot to hold for long. Mineral crust on the lid already.',
  lab: { rp: 12, time: 4, text: 'Near boiling, loaded with silica and arsenic. Yet there are bacteria living in it, happily.' } });
defineItem({ id: 'smp_sulfur', name: 'Sulfur crystals', kind: 'material', stack: 6, weight: 0.2, where: 'The Hot Valley',
  desc: 'Bright yellow needles of crystal from around a steam vent. They smell awful.',
  lab: { rp: 11, time: 3, text: 'Native sulfur, grown straight out of volcanic gas. A good sign the magma below is close.' } });
defineItem({ id: 'smp_crystal', name: 'Throat crystal', kind: 'material', stack: 3, weight: 0.3, where: 'Te Korokoro',
  desc: 'A cloudy quartz crystal from the sinkhole wall. In the dark it glows a faint green.',
  lab: { rp: 26, time: 6, text: 'Quartz with a film of glowing bacteria living in its cracks, the same kind as in the Glowing Forest. The sinkhole and the valley share a water table, deep down.' } });
defineItem({ id: 'smp_scree', name: 'Striped rock sample', kind: 'material', stack: 6, weight: 0.6, where: 'Bone Cliffs',
  desc: 'A fist-sized chunk of the gorge wall, banded grey, red and cream.',
  lab: { rp: 9, time: 3, text: 'Layers of mudstone and ash. Each stripe is a flood, or an eruption, a few thousand years apart.' } });
// ------------------------------------------------------------------ plants and fungi
defineItem({ id: 'plt_lanterncap', name: 'Lantern-cap', kind: 'fungus', stack: 6, weight: 0.2, where: 'The Glowing Forest',
  desc: 'A mushroom cap the size of a dinner plate. Its gills glow sea-green.',
  lab: { rp: 14, time: 4, text: 'The glow is a chemical reaction the fungus runs all night. It attracts beetles that carry its spores, and the light feeds whole food chains in a valley that never sees the sun.' } });
defineItem({ id: 'plt_ghostfern', name: 'Ghost fern', kind: 'plant', stack: 6, weight: 0.1, where: 'The Glowing Forest',
  desc: 'A pale, almost white fern that grows in deep shade.',
  lab: { rp: 12, time: 3, text: 'Barely any chlorophyll: it lives off the fungal network in the soil instead of the sun. A plant that gave up on light.' } });
defineItem({ id: 'plt_thermomat', name: 'Hot-spring mat', kind: 'plant', stack: 6, weight: 0.2, where: 'The Hot Valley',
  desc: 'A rubbery orange and green mat peeled from the edge of a hot pool.',
  lab: { rp: 14, time: 4, text: 'Layers of microbes that love heat: green ones on top using the light, orange ones below eating what they make. Life like this was the first life on Earth.' } });
defineItem({ id: 'plt_cavelichen', name: 'Cave lichen', kind: 'fungus', stack: 6, weight: 0.05, where: 'Sea Grotto',
  desc: 'Silver crusty lichen from the twilight zone of the cave.',
  lab: { rp: 8, time: 3, text: 'A fungus farming algae inside itself. It grows a millimetre a year: these patches are older than the wreck by centuries.' } });
defineItem({ id: 'plt_pavine', name: 'Pā vine flower', kind: 'plant', stack: 6, weight: 0.05, where: 'The Old Pā',
  desc: 'A creeper with blood-red tube flowers, growing over the old stone walls.',
  lab: { rp: 10, time: 3, text: 'Kākā-beak-shaped flowers built for a long bill. Something with a long bill visits the old pā.' } });
defineItem({ id: 'plt_throatfern', name: 'Giant fern spores', kind: 'plant', stack: 6, weight: 0.05, where: 'Te Korokoro',
  desc: 'A paper twist of rust-brown spores from a tree fern three times taller than any in Fernwood.',
  lab: { rp: 20, time: 5, text: 'A tree fern species known only from fossils, alive at the bottom of the sinkhole. Te Korokoro is a refuge of a much older world.' } });
// ------------------------------------------------------------------ village gifts and food
defineItem({ id: 'gift_kete', name: 'Woven flax bag', kind: 'key', stack: 1, weight: 0.3, where: 'A gift from Whaea Mere',
  desc: 'A tightly woven harakeke bag with a shoulder strap, made by Aroha’s aunt. Holds more than it looks like it should.' });
defineItem({ id: 'vil_rewena', name: 'Rēwena bread', kind: 'food', stack: 6, weight: 0.3, eat: 'energy', energy: 25, where: 'Te Kāinga',
  desc: 'Sourdough potato bread from the village oven, still warm. Restores a lot of energy.' });
defineItem({ id: 'vil_kumara', name: 'Roasted kūmara', kind: 'food', stack: 8, weight: 0.25, eat: 'energy', energy: 18, where: 'Te Kāinga',
  desc: 'Sweet potato baked in the embers. Sticky, sweet, filling.' });
defineItem({ id: 'vil_tea', name: 'Kawakawa tea flask', kind: 'food', stack: 4, weight: 0.5, eat: 'quiet', energy: 12, where: 'Te Kāinga',
  desc: 'A gourd flask of peppery kawakawa tea. Warms you up and calms the hands.' });
// ------------------------------------------------------------------ Joshu's lost things (return them at camp)
defineItem({ id: 'joshu_compass', name: 'Joshu’s brass compass', kind: 'key', stack: 1, weight: 0.2, where: 'Lost in the storm',
  desc: 'A heavy brass compass with “K” scratched on the lid and a photo of a young Jenna inside. Joshu will be very glad to see this.' });
defineItem({ id: 'joshu_cap', name: 'Joshu’s spare cap', kind: 'key', stack: 1, weight: 0.1, where: 'Lost in the storm',
  desc: 'The red skipper’s cap, salt-stiff. Something has been chewing the brim. It still smells of pipe tobacco.' });
defineItem({ id: 'joshu_log', name: 'Pages of the Kittiwake’s log', kind: 'key', stack: 1, weight: 0.1, where: 'Lost in the storm',
  desc: 'Three soggy pages in Joshu’s handwriting. The last entry: “Something big under the hull. Not a whale.”' });

/** the V10 finds by category (for the research pages) */
export const FINDS10 = {
  taonga: ['taonga_toggle', 'taonga_toki', 'taonga_matau'],
  artifacts: ['art_bottle', 'art_tag', 'art_glyphrub'],
  fossils: ['fos_vertebra', 'fos_ammonite', 'fos_leaf', 'fos_tooth', 'fos_shell'],
  samples: ['smp_limestone', 'smp_cavewater', 'smp_soil', 'smp_mud', 'smp_falls', 'smp_ash', 'smp_hotwater', 'smp_sulfur', 'smp_crystal', 'smp_scree'],
  flora: ['plt_lanterncap', 'plt_ghostfern', 'plt_thermomat', 'plt_cavelichen', 'plt_pavine', 'plt_throatfern'],
  gifts: ['gift_kete', 'vil_rewena', 'vil_kumara', 'vil_tea'],
  joshu: ['joshu_compass', 'joshu_cap', 'joshu_log'],
};

// ------------------------------------------------------------------ little sprites for finds on the ground
const S = (b: PixelBuffer, ax: number, ay: number): Sprite => { b.outline(hex('#140c08')); return { buf: b, ax, ay }; };
export const findArt = {
  /** a jar with a coloured fill (water, mud) set down on the ground: where to take a sample */
  sampleSpot(col: string): Sprite {
    const b = new PixelBuffer(14, 12);
    const c = hex(col);
    b.ellipse(7, 9, 6, 2.4, shade(c, -0.25));
    b.ellipse(7, 8.5, 4.5, 1.6, c);
    for (let i = 0; i < 4; i++) b.set(3 + i * 2.5, 9 + (i % 2), mix(c, hex('#ffffff'), 0.5));
    return S(b, 7, 11);
  },
  /** a crumbly patch of soil / rock with a trowel mark */
  dig(col: string): Sprite {
    const b = new PixelBuffer(18, 8);
    const c = hex(col), rng = new Rng(col.length * 7);
    for (let x = 1; x < 17; x++) { const h = 2 + Math.round(Math.sin(x * 0.6) + rng.next() * 2); for (let y = 8 - h; y < 8; y++) b.set(x, y, rng.next() < 0.25 ? shade(c, -0.2) : c); }
    b.rect(8, 2, 1, 4, hex('#9aa3a5'));
    return S(b, 9, 7);
  },
  /** something small glinting half buried */
  glint(col: string): Sprite {
    const b = new PixelBuffer(10, 6);
    b.ellipse(5, 4, 4, 1.6, hex('#4a3a2a'));
    b.ellipse(5, 3.2, 2.2, 1.2, hex(col));
    b.set(4, 2, hex('#ffffff'));
    return S(b, 5, 5);
  },
  /** a fern-like plant to sample */
  plant(col: string, h = 18): Sprite {
    const b = new PixelBuffer(16, h + 2);
    const c = hex(col);
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + i * 0.55;
      for (let t = 0; t < h - 2; t++) { const x = 8 + Math.sin(a) * t * 0.55, y = h - Math.cos(a) * t * 0.9; b.set(x, y, t % 3 === 0 ? shade(c, 0.25) : c); }
    }
    return S(b, 8, h);
  },
};

/** finds in the existing places (the island shore and the V2 sites) */
export const POINTS10: Record<string, Point10[]> = {
  // ---- the home island
  'isle-wreck': [
    { id: 'lm:wreck', kind: 'landmark', name: 'Wreck of the Kittiwake', x: 690, photo: { w: 300, h: 120 }, note: 'Our boat. Gerald the fish still lives in the tank.' },
  ],
  'isle-stream': [
    { id: 'pt:streamwater', kind: 'sample', name: 'Stream water', x: 3740, art: () => findArt.sampleSpot('#5aa0b0'), note: 'Fresh water, coming from deep inland.', take: { item: 'smp_falls', verb: 'Fill a sample jar from the stream', tools: ['jar'], time: 1.6, line: 'Funny. It’s as cold as meltwater, and we’re at sea level.' } },
  ],
  'isle-cave': [
    { id: 'eco:glowworms', kind: 'ecosystem', name: 'Glowworm colony', x: 5200, y: 120, photo: { w: 220, h: 60, dy: 0 }, note: 'Thousands of glowworms on the cave roof: a living starry sky.' },
  ],
  'isle-track': [
    { id: 'pt:tracksoil', kind: 'sample', name: 'Bush soil', x: 6400, art: () => findArt.dig('#3a2a1c'), take: { item: 'smp_soil', verb: 'Take a soil core', tools: ['trowel'], time: 1.8 } },
  ],
  // ---- Fernwood Floor
  fernwood: [
    { id: 'lm:fw:kauri', kind: 'landmark', name: 'The giant kauri', x: 2280, photo: { w: 90, h: 260 }, note: 'The biggest tree I have ever seen. You can climb it to the canopy.' },
    { id: 'pt:fw:soil', kind: 'sample', name: 'Forest soil', x: 1060, art: () => findArt.dig('#2a1c12'), note: 'Soil laced with fungal threads.', take: { item: 'smp_soil', verb: 'Take a soil core', tools: ['trowel'], time: 1.8, line: 'Look at all these white threads. The whole floor is wired together.' } },
    { id: 'eco:fw:gully', kind: 'ecosystem', name: 'The frog gully', x: 1570, photo: { w: 170, h: 50 }, note: 'Moss frogs breed in the stream gully.' },
  ],
  // ---- Emerald Canopy
  canopy: [
    { id: 'taonga_toki', kind: 'artifact', name: 'Stone toki in the roots', x: 1185, art: () => findArt.glint('#3a4a44'), note: 'A stone adze left in a kauri’s roots, high in the canopy.',
      take: { item: 'taonga_toki', verb: 'Carefully free the stone toki', time: 2.6, line: 'An adze! Up here! Someone climbed all this way to carve something.', aroha: 'That is a toki. Somebody’s tūpuna made it. Hold it with both hands, Mori: it goes home to the kāinga.' } },
    { id: 'lm:cn:view', kind: 'landmark', name: 'The view over the plateau', x: 1620, photo: { w: 240, h: 140, dy: -60 }, note: 'From the canopy you can see stone walls on the far ridge.' },
  ],
  // ---- Thunder Falls
  falls: [
    { id: 'lm:fa:falls', kind: 'landmark', name: 'Thunder Falls', x: 1180, photo: { w: 110, h: 280 }, note: 'The river drops off the plateau. Auks above, dippers behind.' },
    { id: 'pt:fa:water', kind: 'sample', name: 'Plunge pool water', x: 860, art: () => findArt.sampleSpot('#6ab8c8'), take: { item: 'smp_falls', verb: 'Fill a sample jar at the pool', tools: ['jar'], time: 1.6 } },
  ],
  // ---- Blackwater Mangroves
  mangrove: [
    { id: 'taonga_matau', kind: 'artifact', name: 'Bone matau in the mud', x: 1020, art: () => findArt.glint('#e8e0c8'), note: 'A bone fishhook, lost in the channel bank.',
      take: { item: 'taonga_matau', verb: 'Pick the bone hook out of the mud', time: 2, line: 'A fishhook. Carved from bone. Beautiful.', aroha: 'Matau. A fisher’s hook. Someone up the river lost this. We give it back.' } },
    { id: 'pt:mg:mud', kind: 'sample', name: 'Black mud', x: 2120, art: () => findArt.dig('#141210'), take: { item: 'smp_mud', verb: 'Scoop a mud sample', tools: ['jar'], time: 1.8, line: 'Smells like a hard-boiled egg that has given up on life.' } },
  ],
  // ---- Serpent Coast
  coast: [
    { id: 'lm:co:whale', kind: 'landmark', name: 'Whale bones', x: 1300, photo: { w: 100, h: 40 }, note: 'The ribs of something huge, picked clean by the Monarchs.' },
    { id: 'lm:co:headland', kind: 'landmark', name: 'The sea arch', x: 160, photo: { w: 200, h: 200, dy: 0 }, note: 'A sea arch through the headland.' },
  ],
  deep: [
    { id: 'eco:dp:kelp', kind: 'ecosystem', name: 'Kelp forest', x: 900, photo: { w: 200, h: 160 }, note: 'Kelp as tall as trees, with god rays coming down through it.' },
  ],
};
