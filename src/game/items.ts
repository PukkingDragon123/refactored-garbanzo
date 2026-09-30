// Items: tools, building materials, collectible samples, lures and food.

export type ItemKind = 'tool' | 'material' | 'plant' | 'fungus' | 'insect' | 'animal' | 'lure' | 'food' | 'key' | 'shell';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  /** max per inventory slot */
  stack: number;
  /** laptop analysis: research points & what it reveals */
  lab?: { rp: number; time: number; text: string; clue?: string; species?: string; fact?: string };
  /** a hint for where it's found */
  where?: string;
  /** food: effect id */
  eat?: string;
}

export const ITEMS: Record<string, ItemDef> = {};
const def = (d: ItemDef) => (ITEMS[d.id] = d);

// ------------------------------------------------------------------ tools (kept on the tool belt)
def({ id: 'camera', name: 'Field camera', kind: 'tool', stack: 1, desc: 'A battered mirrorless camera with a long lens. Your most important tool.' });
def({ id: 'knife', name: 'Pocket knife', kind: 'tool', stack: 1, desc: 'For cutting plant samples, flax and resin.' });
def({ id: 'jar', name: 'Specimen jars', kind: 'tool', stack: 1, desc: 'Glass jars for crawling insects and small samples.' });
def({ id: 'net', name: 'Bug net', kind: 'tool', stack: 1, desc: 'A fine-mesh net for flying insects.' });
def({ id: 'trowel', name: 'Trowel', kind: 'tool', stack: 1, desc: 'For digging up fungi, roots and grubs.' });
def({ id: 'tweezers', name: 'Tweezers', kind: 'tool', stack: 1, desc: 'For fur, feathers and scales without contaminating them.' });
def({ id: 'gloves', name: 'Lab gloves', kind: 'tool', stack: 1, desc: 'For droppings and anything you really should not touch bare-handed.' });
def({ id: 'hammer', name: 'Hammer', kind: 'tool', stack: 1, desc: 'Salvaged from the wreck. For building camp.' });
def({ id: 'headlamp', name: 'Headlamp', kind: 'tool', stack: 1, desc: 'Lights the way at night.' });
def({ id: 'translator', name: 'Phone', kind: 'tool', stack: 1, desc: 'Cracked screen, 11% battery. Has a torch and an offline translator app that mostly works.' });
def({ id: 'ghillie', name: 'Ghillie cape', kind: 'tool', stack: 1, desc: 'A cape woven from fern fronds and flax. Animals have a much harder time spotting you.' });
def({ id: 'binoculars', name: 'Binoculars', kind: 'tool', stack: 1, desc: 'Crowe’s old brass binoculars. Scout wildlife from far away.' });

// ------------------------------------------------------------------ materials
def({ id: 'canvas', name: 'Tent canvas', kind: 'material', stack: 2, desc: 'A rolled tent from the wreck, soaked but intact.', where: 'Wreck' });
def({ id: 'poles', name: 'Tent poles', kind: 'material', stack: 4, desc: 'Aluminium poles. A little bent.', where: 'Wreck' });
def({ id: 'rope', name: 'Rope', kind: 'material', stack: 10, desc: 'Strong rope. Make more from flax fibre.' });
def({ id: 'flax', name: 'Flax fibre', kind: 'material', stack: 20, desc: 'Tough fibre stripped from flax leaves. Twists into rope.', where: 'Flax bushes' });
def({ id: 'wood', name: 'Firewood', kind: 'material', stack: 20, desc: 'Dry branches and driftwood.', where: 'Beach & forest floor' });
def({ id: 'stone', name: 'Stones', kind: 'material', stack: 20, desc: 'Smooth beach stones.', where: 'Beach' });
def({ id: 'plank', name: 'Planks', kind: 'material', stack: 10, desc: 'Broken planks from the hull.', where: 'Wreck' });
def({ id: 'scrap', name: 'Scrap metal', kind: 'material', stack: 10, desc: 'Bolts, brackets and bits of the engine.', where: 'Wreck' });
def({ id: 'resin', name: 'Kauri resin', kind: 'material', stack: 10, desc: 'Sticky golden resin. Burns bright and glues well.', where: 'Kauri trunks (knife)' });
def({ id: 'wire', name: 'Copper wire', kind: 'material', stack: 10, desc: 'Stripped from the wheelhouse wiring. Pip wants all of it.', where: 'Wreck' });
def({ id: 'pipe', name: 'Captain’s pipe', kind: 'key', stack: 1, desc: 'A briar pipe with teeth marks and an anchor carved on the bowl. Crowe will want this back.', where: 'Tide pools by the wreck' });
def({ id: 'mussel', name: 'Tide-pool mussels', kind: 'food', stack: 12, desc: 'Blue-black mussels from the rocks. Bait, or dinner.', where: 'Tide pools', eat: 'energy' });
def({ id: 'battery', name: 'Battery pack', kind: 'material', stack: 4, desc: 'A sealed battery from the boat. Powers the laptop.', where: 'Wreck' });

// ------------------------------------------------------------------ plants
def({ id: 'fernfrond', name: 'Silver fern frond', kind: 'plant', stack: 10, desc: 'The underside shines silver in moonlight.', where: 'Tree ferns (knife)',
  lab: { rp: 6, time: 3, text: 'Silica crystals on the underside reflect light. Aroha says hunters once laid fronds silver-side up to mark a trail home.' } });
def({ id: 'flaxleaf', name: 'Flax leaf', kind: 'plant', stack: 10, desc: 'Long, sword-shaped leaf full of strong fibre.', where: 'Flax bushes (knife)',
  lab: { rp: 4, time: 2, text: 'Extremely strong fibres. Strip and twist three for a rope.' } });
def({ id: 'kawakawa', name: 'Kawakawa leaf', kind: 'plant', stack: 10, desc: 'Heart-shaped leaves, peppery smell. Riddled with insect holes.', where: 'Forest edge',
  lab: { rp: 8, time: 3, text: 'Contains anti-inflammatory compounds. The holey leaves are said to be the best ones. Aroha uses it for tea.' } });
def({ id: 'ratabloom', name: 'Rata blossom', kind: 'plant', stack: 10, desc: 'A scarlet pom-pom of stamens dripping with nectar.', where: 'Canopy branches',
  lab: { rp: 8, time: 3, text: 'Heavy nectar load; pollen matches pollen found on Sail Possum fur.', species: 'sailglider' } });
def({ id: 'pitcher', name: 'Pitcher plant', kind: 'plant', stack: 5, desc: 'A carnivorous pitcher half-full of drowned insects.', where: 'Boggy ground (knife)',
  lab: { rp: 12, time: 4, text: 'Digestive fluid dissolves insects. Several wētā legs inside.' } });
def({ id: 'moonfruit', name: 'Moonfruit', kind: 'plant', stack: 12, desc: 'Pale, fragrant fruit that drops at night. Foragers go wild for it.', where: 'Fruit trees',
  lab: { rp: 5, time: 2, text: 'High sugar. Tooth marks from Quillhogs and Bonebrows.' } });
def({ id: 'moss', name: 'Cushion moss', kind: 'plant', stack: 10, desc: 'Spongy moss that holds water like a sponge.', where: 'Logs & rocks',
  lab: { rp: 3, time: 2, text: 'Tiny springtails live inside. The forest floor is full of life you cannot see.' } });

// ------------------------------------------------------------------ fungi
def({ id: 'glowcap', name: 'Glowcap', kind: 'fungus', stack: 10, desc: 'A mushroom that glows cyan in the dark.', where: 'Rotten logs (trowel)',
  lab: { rp: 10, time: 4, text: 'Bioluminescent. The glow attracts night insects, which spread its spores. Lantern Lure-Vipers may use similar bacteria.' } });
def({ id: 'bracket', name: 'Shelf bracket', kind: 'fungus', stack: 6, desc: 'A woody bracket fungus growing from a trunk.', where: 'Trunks (knife)',
  lab: { rp: 7, time: 3, text: 'Decades old. Rings show growth each wet season.' } });
def({ id: 'inkcap', name: 'Violet inkcap', kind: 'fungus', stack: 10, desc: 'A purple mushroom that melts into ink when old.', where: 'Leaf litter (trowel)',
  lab: { rp: 6, time: 3, text: 'The ink stains everything violet. Good for field-note sketches.' } });

// ------------------------------------------------------------------ insects
def({ id: 'lanternbeetle', name: 'Lantern beetle', kind: 'insect', stack: 6, desc: 'A beetle with a softly glowing abdomen.', where: 'Logs at night (jar)',
  lab: { rp: 14, time: 4, text: 'Glow pattern flashes in species-specific codes: it is how they find each other.' } });
def({ id: 'weta', name: 'Giant wētā', kind: 'insect', stack: 4, desc: 'A huge, armoured cricket the size of your hand.', where: 'Under bark (jar, gloves)',
  lab: { rp: 16, time: 5, text: 'Ancient insect lineage. With so few small birds here, wētā grew enormous and fill the niche of mice.' } });
def({ id: 'skymoth', name: 'Sky moth', kind: 'insect', stack: 6, desc: 'A big day-flying moth with eye-spots on its wings.', where: 'Clearings (net)',
  lab: { rp: 12, time: 4, text: 'The eye-spots mimic a serpent’s eye. Everything here fears snakes.' } });
def({ id: 'mantis', name: 'Leaf mantis', kind: 'insect', stack: 6, desc: 'A mantis that looks exactly like a fern leaflet.', where: 'Fern fronds (jar)',
  lab: { rp: 12, time: 4, text: 'Perfect camouflage. You found it by the eyes.' } });
def({ id: 'dragonfly', name: 'Needle dragonfly', kind: 'insect', stack: 6, desc: 'A metallic-blue dragonfly that hunts over water.', where: 'Water (net)',
  lab: { rp: 10, time: 3, text: 'Compound eyes with nearly 360° vision.' } });
def({ id: 'grub', name: 'Huhu grub', kind: 'insect', stack: 12, desc: 'A fat beetle larva from rotten wood. Serpents love them.', where: 'Rotten logs (trowel)',
  lab: { rp: 3, time: 2, text: 'Rich in fat. Strider Serpents dig for these.' } });

// ------------------------------------------------------------------ animal samples
def({ id: 'furtuft', name: 'Fur tuft', kind: 'animal', stack: 8, desc: 'Brown fur caught on a thorn.', where: 'Thorn bushes (tweezers)',
  lab: { rp: 12, time: 4, text: 'Guard hairs are hollow and water-repellent: a burrower. Matches Tunnel Delver fur.', clue: 'fur-tuft', species: 'delver' } });
def({ id: 'feather', name: 'Barred feather', kind: 'animal', stack: 8, desc: 'A long, stiff flight feather barred brown and white.', where: 'Under cliffs & trees (tweezers)',
  lab: { rp: 12, time: 4, text: 'An aerodynamic primary built for high-speed dives. Gale Hawk.', species: 'galehawk' } });
def({ id: 'scale', name: 'Shed scale', kind: 'animal', stack: 8, desc: 'A keeled serpent scale, rough on one side.', where: 'Rocks (tweezers)',
  lab: { rp: 14, time: 4, text: 'Keeled scales grip rock. A climber: probably a Crag Viper.', species: 'cragviper' } });
def({ id: 'shedskin', name: 'Shed skin', kind: 'animal', stack: 4, desc: 'A papery, complete serpent skin.', where: 'Forest floor (tweezers)',
  lab: { rp: 16, time: 5, text: 'Four little limb sheaths. A Strider Serpent: its legs are real limbs, not vestigial.', species: 'strider' } });
def({ id: 'dropping', name: 'Droppings', kind: 'animal', stack: 8, desc: 'Fresh droppings full of undigested bits. Lovely.', where: 'Trails (gloves)',
  lab: { rp: 15, time: 5, text: 'Packed with serpent scales and one broken fang. Whatever left this EATS snakes.', clue: 'scat-scales', species: 'flicker' } });
def({ id: 'quill', name: 'Banded quill', kind: 'animal', stack: 8, desc: 'A long, barbed quill banded black and cream.', where: 'Forest floor (tweezers)',
  lab: { rp: 12, time: 4, text: 'Microscopic backward barbs. Easy to shed, hard to remove. Quillhog.', species: 'quillhog' } });
def({ id: 'bone', name: 'Serpent vertebra', kind: 'animal', stack: 6, desc: 'A vertebra the size of your fist, with crushing marks.', where: 'Mudbanks',
  lab: { rp: 18, time: 5, text: 'Crushed by enormous jaws. Something here preys on large serpents.', clue: 'vertebrae', species: 'ironjaw' } });
def({ id: 'eggshell', name: 'Eggshell', kind: 'animal', stack: 6, desc: 'Gold-speckled shell fragments.', where: 'Under nesting cliffs',
  lab: { rp: 12, time: 4, text: 'Crag Auk egg, cracked open from the outside by a narrow snout.', clue: 'eggshell', species: 'cragauk' } });
def({ id: 'plate', name: 'Armour plate', kind: 'animal', stack: 6, desc: 'A shed bony plate with fang marks that failed to pierce it.', where: 'Forest floor',
  lab: { rp: 14, time: 4, text: 'Osteoderm: bone growing in the skin. Shieldback armour works.', clue: 'scute', species: 'shieldback' } });

// ------------------------------------------------------------------ lures (crafted)
def({ id: 'fruitlure', name: 'Fruit lure', kind: 'lure', stack: 6, desc: 'Mashed moonfruit wrapped in a leaf. Foragers can’t resist it.' });
def({ id: 'grublure', name: 'Grub pot', kind: 'lure', stack: 6, desc: 'Wriggling grubs in a pot. Serpents and insect-eaters come running.' });
def({ id: 'fishbait', name: 'Fish bait', kind: 'lure', stack: 6, desc: 'Smelly fish scraps. Birds and water hunters.' });
def({ id: 'scentlure', name: 'Musk lure', kind: 'lure', stack: 4, desc: 'Droppings and resin. Attracts predators. Use with caution.' });
def({ id: 'glowlure', name: 'Glow lure', kind: 'lure', stack: 4, desc: 'Glowcaps in resin. Draws night insects, and whatever eats them.' });
def({ id: 'caller', name: 'Bird caller', kind: 'lure', stack: 4, desc: 'A reed whistle. Birds investigate.' });
def({ id: 'trap', name: 'Camera trap', kind: 'lure', stack: 3, desc: 'Motion-triggered camera. Photographs anything that walks by.' });

// ------------------------------------------------------------------ food
def({ id: 'ration', name: 'Ship biscuit', kind: 'food', stack: 10, desc: 'Hard as a brick. Filling.', eat: 'energy' });
def({ id: 'stew', name: 'Lou’s stew', kind: 'food', stack: 4, desc: 'Hot, spicy, mysterious. Steadies the hands.', eat: 'steady' });
def({ id: 'tea', name: 'Kawakawa tea', kind: 'food', stack: 4, desc: 'Peppery tea. Calm and quiet on your feet.', eat: 'quiet' });

// ------------------------------------------------------------------ V9 island collectibles and harvestables
// (placed and harvested in the island scene by src/game/v9/forage.ts; icons in src/art/itemicons.ts)
def({ id: 'shell_sunwhorl', name: 'Sunwhorl shell', kind: 'shell', stack: 20, desc: 'A golden spiral shell, warm to the touch after a morning in the sun.', where: 'Landing beach sand' });
def({ id: 'shell_fan', name: 'Fanshell', kind: 'shell', stack: 20, desc: 'A pink, deeply ribbed fan. Hold it to your ear: surf.', where: 'Tide line' });
def({ id: 'shell_cone', name: 'Tiger cone', kind: 'shell', stack: 20, desc: 'A cone shell banded like a tiger. Empty, luckily.', where: 'Buried in wet sand (dig)' });
def({ id: 'shell_opal', name: 'Opal ear', kind: 'shell', stack: 10, desc: 'An ear-shaped shell with a lining of blue-green fire.', where: 'Rock pools' });
def({ id: 'shell_trycop', name: 'Trycop moult', kind: 'shell', stack: 5, desc: 'A whole shed claw of a Trycop crab, round spots and all. It is bigger than your hand.', where: 'Seal rocks',
  lab: { rp: 14, time: 4, text: 'The moult is complete down to the joint membranes: the Trycop crab sheds its whole armour at once and hides for days while the new shell hardens.', species: 'trycop' } });
def({ id: 'driftglass', name: 'Sea glass', kind: 'material', stack: 20, desc: 'Bottle glass tumbled frosty and smooth by the surf.', where: 'Tide line' });
def({ id: 'kelp', name: 'Kelp ribbon', kind: 'material', stack: 20, desc: 'A leathery ribbon of kelp. Dries into cord.', where: 'Wrack line' });
def({ id: 'flint', name: 'Flint nodule', kind: 'material', stack: 10, desc: 'Strikes a fat spark off the back of a knife.', where: 'Stream bed' });
def({ id: 'clay', name: 'River clay', kind: 'material', stack: 10, desc: 'Grey, cold and slick. Good for sealing things.', where: 'Stream banks (trowel)' });
def({ id: 'feather', name: 'Seabird feather', kind: 'material', stack: 20, desc: 'A long flight feather washed up on the sand.', where: 'Beach' });
def({ id: 'plant_seaholly', name: 'Sea holly', kind: 'plant', stack: 10, desc: 'A spiky blue-silver coastal herb that smells of pepper and salt.', where: 'Dunes (knife)',
  lab: { rp: 5, time: 2, text: 'Waxy, salt-proof leaves; the spines are hollow and full of bitter sap that keeps grazers off.' } });
def({ id: 'plant_saltfern', name: 'Salt fern', kind: 'plant', stack: 10, desc: 'A fern that grows in the spray zone. Its fronds are crusted with salt crystals.', where: 'Cliffs and rocks (knife)',
  lab: { rp: 6, time: 2, text: 'It pumps salt out through pores on the fronds. The crust reflects heat on the hottest rocks.' } });
def({ id: 'plant_glowmoss', name: 'Glow moss', kind: 'plant', stack: 10, desc: 'A soft moss that glows faint green in the dark.', where: 'Sea cave walls',
  lab: { rp: 10, time: 3, text: 'Not the moss itself: a film of luminous fungus lives in it. The cave glows are a partnership.' } });
def({ id: 'plant_dunelily', name: 'Dune lily bulb', kind: 'plant', stack: 10, desc: 'A starchy bulb. Aroha says roast it in the embers.', where: 'Dunes (trowel)', eat: 'energy' });
def({ id: 'berry_ember', name: 'Emberberries', kind: 'food', stack: 20, desc: 'Glossy red berries from the ember bushes. Sweet, a bit fizzy. Something else loves them too.', where: 'Ember bushes', eat: 'energy',
  lab: { rp: 8, time: 3, text: 'The skins are covered in tiny bite marks: jewel hornets chew them open to drink the juice.', species: 'jewelhornet' } });
def({ id: 'berry_dusk', name: 'Duskberries', kind: 'food', stack: 20, desc: 'Dusty purple berries that taste of plum and pine.', where: 'Bush edge', eat: 'energy' });
def({ id: 'berry_gold', name: 'Goldcurrants', kind: 'food', stack: 20, desc: 'Tiny golden berries in clusters. Tart enough to make you blink.', where: 'Palm grove', eat: 'energy' });
def({ id: 'pipi', name: 'Pipi', kind: 'food', stack: 12, desc: 'Smooth little clams from the wet sand. Twist your feet to find them.', where: 'Wet sand (dig)', eat: 'energy' });
def({ id: 'bug_jewelbeetle', name: 'Jewel beetle', kind: 'insect', stack: 6, desc: 'A metallic green-gold beetle, gorgeous and grumpy.', where: 'Flowers (jar)',
  lab: { rp: 8, time: 3, text: 'The shine is structural: layered chitin that bends light. No pigment at all.' } });
def({ id: 'bug_sandhopper', name: 'Sand hopper', kind: 'insect', stack: 12, desc: 'A springy little amphipod from under the wrack. Bait, or a very small friend.', where: 'Wrack line (jar)' });
def({ id: 'bug_lanternmoth', name: 'Lantern moth', kind: 'insect', stack: 6, desc: 'A pale moth with two glowing spots on its wings.', where: 'Bush at dusk (net)',
  lab: { rp: 10, time: 3, text: 'The spots glow only when it flies: a flash to startle hunters, then darkness.' } });
def({ id: 'bug_hornet', name: 'Jewel hornet', kind: 'insect', stack: 6, desc: 'A dead jewel hornet, striped teal, violet and gold. Even dead it looks cross.', where: 'Near ember bushes',
  lab: { rp: 12, time: 4, text: 'The gut is full of fruit pulp, not meat: a hornet that gave up hunting for berries, and nests underground like an ant.', species: 'jewelhornet' } });

export const item = (id: string) => ITEMS[id];
export const isTool = (id: string) => ITEMS[id]?.kind === 'tool';
export const SAMPLE_KINDS: ItemKind[] = ['plant', 'fungus', 'insect', 'animal'];
export const isSample = (id: string) => SAMPLE_KINDS.includes(ITEMS[id]?.kind);
