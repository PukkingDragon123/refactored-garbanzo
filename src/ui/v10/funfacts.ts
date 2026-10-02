// Zealandia Encyclopedia: one fun fact per field-guide species, the last section a species' page
// reveals. (Species added later without one get a fact made from their own data, see funFact.)

import type { Species } from '../../game/species';

export const FUN: Record<string, string> = {
  // ---- the open ocean
  vanebill: 'Its wings lock at three joints, so a vanebill can glide for days without a single flap, and possibly while asleep.',
  sackjaw: 'The throat sack can balloon to twice the size of its head. Jenna has seen one fit an entire sandwich in it. Hers.',
  scythewing: 'Each wing blade is made of feathers fused into one; a flock skimming the swell leaves a dotted line on the wave tops.',
  moonfin: 'The glowing lines on its flanks are bacteria. A pod surfing the bow wave at night looks like a string of fairy lights.',
  kitefish: 'It never quite lands: it dips its whip tail into a wave crest and sculls off again, like a skater pushing off.',
  reefback: 'Barnacles, coral, anemones, kelp, crabs and fish all live on one Reefback. It is less an animal than an island that breathes.',
  crownlouse: 'A whole crown louse colony can live its entire life on a single Reefback: generations that never see another whale.',
  pennantleech: 'It changes colour as it feeds, from dark red to purple. Mori calls it the mood-ring leech.',
  // ---- the shore
  corvexseal: 'It weighs as much as a small car and still gallops faster than Mori can run. (Tested. Not on purpose.)',
  crownleech: 'Its feathery crown only opens while its host sleeps, so a snoring Corvex Seal is basically ringing the dinner bell.',
  glasscrab: 'You can count its heartbeat straight through the shell. It goes faster when you watch.',
  swashrunner: 'Its lobed "snowshoe" toes spread its weight so well that a whole flock barely leaves footprints on the wet sand.',
  shellwrench: 'Its bill tips cross like pliers, and every bird is either left-crossed or right-crossed, for life.',
  kelpskink: 'It is such a good piece of kelp that a shellwrench once picked one up, looked at it, and put it back.',
  duskwaddler: 'Its feathers have no vanes at all, so it looks furry. Chunk is convinced it is a small, wet dog.',
  periscope: 'It can raise its eyes well above the water on stalks while the rest of it carries on being a rock.',
  twinfan: 'It will follow a person through the bush for an entire afternoon, eating the insects their footsteps kick up.',
  starweb: 'Each glowing bead on its fishing lines is a droplet of sticky mucus; a cave roof full of them looks like a starfield.',
  // ---- fish
  snoutbass: 'Its trunk is a stretched upper lip lined with taste buds: it tastes the sand before it bothers to dig.',
  lanterncod: 'Its glowing lure works like the lantern lure-viper’s tail, but the two invented the trick separately, one on land and one in the sea.',
  sixfinger: 'It grunts when you catch it, drumming muscles against its swim bladder like a tiny, annoyed bass drum.',
  mirrordory: 'Head-on it is so thin and so shiny it nearly vanishes: a mirror held up to the empty sea.',
  hammersnapper: 'A single blow from its brow can knock a limpet clean off a rock. Do not challenge it to a headbutt.',
  bubblepuffer: 'It can swallow three times its own volume in air. Captain Bubbles in the tank does it whenever Joshu taps the glass.',
  ribboneel: 'Its fin runs the whole length of its body, and it swims upright through the dark: sea-serpent stories start here.',
  glassmaomao: 'Its gut is bright blue, possibly to hide the glow of the plankton inside it from anything hungry.',
  spinnaker: 'The big blue sail is a herding flag and an air brake in one: it raises it to corral baitfish and to turn at speed.',
  sunwheel: 'The first fish found to be warm-blooded all over: it keeps its brain and muscles warm in the cold, dark deep.',
  snoutlouse: 'Its relatives replace the tongues of other fish. This one just moves into the nose. Small mercies.',
  // ---- island wildlife
  trycop: 'It moults its entire armour at once, down to the joint membranes, then hides for days while the new shell hardens.',
  rootbarnacle: 'You can only tell it is a barnacle from its larvae: the adult has no shell, no legs and no gut at all.',
  jewelhornet: 'There is no pigment in its colours: layers of cuticle bend the light, like a soap bubble with a stinger.',
  hornetcap: 'It makes its dying host climb high and bite down first, so its spores rain onto the nest below.',
  puppetfluke: 'It turns a snail’s eye stalk into a throbbing fake caterpillar, so a bird will eat it and carry the fluke on.',
  ambersnail: 'Its tongue is covered in thousands of tiny teeth, and it grows new ones as the old ones wear down.',
  canhermit: 'The Kittiwake’s rubbish set off a housing boom. A dog-food tin is, apparently, prime real estate.',
  periscopeeel: 'A colony sinks back into the sand one eel at a time as you walk closer, like a stadium wave in reverse.',
  wrackhopper: 'Not insects at all: tiny crustaceans, cousins of the crabs, that can spring many times their own length.',
  leafmantis: 'It sways in the breeze on purpose: a leaf that keeps perfectly still in the wind would look suspicious.',
  lanternmoth: 'Its spots only glow in flight, when the wing muscles squeeze a pouch of glowing bacteria.',
  skipgoby: 'A fish that would rather be out of the water: it carries a mouthful of sea in its gill chambers like a scuba tank.',
  jewelbeetle: 'Its shine is pure structure: grind a jewel beetle’s wing case to powder and the powder is plain brown.',
  // ---- the old forest, falls and mangrove sites
  strider: 'Its legs are real, re-grown limbs, not leftovers: it walks more quietly over leaf litter than Mori does.',
  sprinter: 'Running upright frees its head for striking, so it can bite mid-sprint without slowing down.',
  skyribbon: 'Every glide is a gamble: Gale Hawks watch the canopy gaps where Skyribbons like to launch.',
  lurevip: 'Sail Possums mistake its glowing tail for a luminous flower. It is the worst flower in the forest.',
  titan: 'After swallowing an Ironjaw it can go weeks without eating, and the Monarchs know to wait nearby.',
  leviathan: 'It breathes underwater through feathery gill fronds, like a twenty-five metre axolotl.',
  mudribbon: 'Its nostrils sit on top of its snout, so it can breathe while every other part of it is hidden.',
  cragviper: 'Its keeled belly scales can climb sheer rock, which is the whole reason the auks nest where they do.',
  galehawk: 'It stoops at over 200 km/h onto gliding serpents. The snakes, it turns out, should look up.',
  cragauk: 'A courtship display is judged on volume: the colony can be heard over the roar of the falls.',
  torrentdipper: 'It walks along the stream bed on purpose, using its dense bones as ballast.',
  snakestork: 'Pairs court with a bill-clattering duet that sounds like distant thunder: hence the name.',
  shieldback: 'Its plates are bone growing inside the skin, like a crocodile’s, and lock into a ball no jaw can grip.',
  quillhog: 'A snake that tries once rarely tries twice. A quill in the lip is a very effective teacher.',
  delver: 'A single tunnel town can have dozens of entrances, and a sentinel standing guard at almost every one.',
  sailglider: 'Its brush-tipped tongue makes it one of the red rata’s most important pollinators.',
  flicker: 'Its reflexes are twice as fast as a viper’s strike, and its blood shrugs off the venom anyway.',
  ironjaw: 'It basks with its jaws wide open to let heat out of its mouth: crocodile air conditioning.',
  boneface: 'A coat of drying mud is its sunscreen and insect repellent in one. Calves get theirs at the wallow.',
  hunterbat: 'Its ears are so sharp it can hear a wētā’s footsteps on bark from across a clearing.',
  mossfrog: 'Its tongue shoots out in a fifteenth of a second. Moths never see it coming.',
  barkgecko: 'Its toe pads grip with molecular forces; it could hang from a pane of glass by one foot.',
  pteramander: 'An amphibian afraid of water: it glides ten metres between trunks to stay out of reach of what lives below.',
  monarch: 'The largest flying animal anyone has seen can ride the thermals for hours without one wingbeat.',
  nutcracker: 'Its beak cracks moonfruit seeds a hammer struggles with, and one of the flock always keeps watch.',
};

/** the fun fact of a species (a size comparison for species without a written one) */
export function funFact(sp: Species): string {
  if (FUN[sp.id]) return FUN[sp.id];
  const m = /([\d.]+)\s*(m|cm)\b/.exec(sp.size);
  if (m) {
    const metres = +m[1] * (m[2] === 'cm' ? 0.01 : 1);
    const cmp = metres >= 10 ? 'longer than a bus' : metres >= 3 ? 'longer than Joshu’s dinghy' : metres >= 1 ? 'about as long as Mori is tall, give or take' : metres >= 0.2 ? 'about the length of Chunk' : 'small enough to sit on a fingertip';
    return `At ${sp.size}, the ${sp.name} is ${cmp}.`;
  }
  return `Nobody had ever photographed a ${sp.name} before this expedition. Now somebody has.`;
}
