// The V2 script: every conversation, reaction and bark, as bubble lines.
// Cast: rowan (player, they/them), crowe (captain), lou (cook), pip (engineer), aroha (guide), phone.

import type { BubbleLine } from '../ui/bubbles';
import { game } from './game';
import { QUEST_BY_ID, questStatus, startQuest, offerable } from './quests';
import { count, remove } from './inventory';
import { buildDone } from './crafting';
import { SPECIES } from './species';

type O = Partial<Omit<BubbleLine, 'who' | 'text'>>;
export const L = (who: string, text: string, o: O = {}): BubbleLine => ({ who, text, ...o });
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// ==================================================================== PROLOGUE: THE VOYAGE

export const PROLOGUE_OPEN: BubbleLine[] = [
  L('rowan', 'Day twenty-one aboard the Kittiwake. Still no sign of the current.', { style: 'think', expr: 'thinking' }),
  L('rowan', 'Sea is flat as glass. Sky is blue. I should talk to the crew before I go stir-crazy.', { style: 'think', expr: 'neutral' }),
];

export function croweTalk(): BubbleLine[] {
  if (game.save.flags['talk:crowe']) return [pick([
    L('crowe', 'Glass is still falling, Doc. Keep your camera dry.', { expr: 'serious' }),
    L('crowe', 'Forty years at sea. Never seen water this calm. I don’t like it.', { expr: 'grumpy' }),
    L('crowe', 'Go on, eat something. Lou gets upset if you don’t.', { expr: 'neutral' }),
  ])];
  return [
    L('crowe', 'Doc. You’re up.', { expr: 'grumpy' }),
    L('crowe', 'Three weeks chasing a current that isn’t on any chart. Your university’s paying for the diesel, so I’m not complaining.', { expr: 'neutral' }),
    L('crowe', 'Much.', { expr: 'grumpy', react: 'nod' }),
    L('rowan', 'Anything on the sonar?', {
      choices: ['Anything on the sonar?', 'What’s the forecast?'],
    }),
    L('crowe', 'Something big pinged us this morning. Two hundred metres down, moving against the current.', { expr: 'serious' }),
    L('crowe', 'And the barometer’s dropping like a stone. Clear skies down here are just the sea taking a breath.', { expr: 'worried', emote: 'sweat' }),
    L('rowan', 'Something big? Like a whale?', { expr: 'surprised', emote: 'question' }),
    L('crowe', 'Like nothing I’ve got a name for. Go on, get some lunch. Lou’s made something. I think.', { expr: 'neutral' }),
  ];
}

export function pipTalk(): BubbleLine[] {
  if (game.save.flags['talk:pip']) return [pick([
    L('pip', 'The engine’s purring! Mostly! That clunk is normal!', { expr: 'happy' }),
    L('pip', 'Did you know duct tape has a tensile strength of— never mind. It’s holding.', { expr: 'smug' }),
    L('pip', 'If you see anything weird out there, photograph it. Weird is data!', { expr: 'happy', emote: 'sparkle' }),
  ])];
  return [
    L('pip', 'Nope. Nope nope nope— OH! Hi Rowan!', { expr: 'surprised', emote: 'exclaim', react: 'jump' }),
    L('pip', 'The old girl’s running at, like, ninety-two percent. The other eight percent is duct tape.', { expr: 'happy' }),
    L('rowan', 'Is that... safe?', { expr: 'worried' }),
    L('pip', 'Totally! Probably! I also fixed your camera strap. And overclocked your laptop. And put a sticker on it.', { expr: 'happy', emote: 'sparkle' }),
    L('pip', 'You’re welcome!', { expr: 'smug', react: 'bounce' }),
  ];
}

export function louTalk(): BubbleLine[] {
  if (game.save.flags['ate']) return [pick([
    L('lou', 'Seconds? There’s always seconds.', { expr: 'happy' }),
    L('lou', 'Crowe’s been rubbing his knee all morning. His knee is never wrong about weather.', { expr: 'worried' }),
    L('lou', 'Go look at the birds, sweetheart. I’ll save you pudding.', { expr: 'happy' }),
  ])];
  return [
    L('lou', 'There’s my favourite scientist! Sit, sit. You look like you’ve been living on granola bars.', { expr: 'happy', emote: 'heart' }),
    L('rowan', 'I have been living on granola bars.', { expr: 'tired' }),
    L('lou', 'Not on my boat. Fish stew, fry bread, and a pudding I am not telling you about.', { expr: 'smug' }),
  ];
}

export const LUNCH_DONE: BubbleLine[] = [
  L('lou', 'Good? Of course it’s good.', { expr: 'happy', react: 'bounce' }),
  L('rowan', 'Lou, this is the best thing I’ve eaten in a month.', { expr: 'happy', emote: 'heart' }),
  L('lou', 'I know. Now go and look at that big bird Crowe keeps muttering about.', { expr: 'teasing' }),
];

export const MONARCH_SEEN: BubbleLine[] = [
  L('rowan', 'What... is that?', { expr: 'shocked', emote: 'interrobang', react: 'jump' }),
  L('rowan', 'That wingspan has to be five metres. Nothing that size should be able to fly!', { expr: 'surprised' }),
  L('rowan', 'Camera. Camera camera camera.', { expr: 'determined', style: 'think' }),
];

export const MONARCH_SHOT: BubbleLine[] = [
  L('rowan', 'Got something! I should check it before I celebrate. Half my shots are usually blurry.', { expr: 'happy' }),
];

export const STORM_START: BubbleLine[] = [
  L('crowe', 'DOC! Squall line! A big one, coming fast!', { style: 'shout', expr: 'angry', emote: 'alarm' }),
  L('crowe', 'Pip, keep that engine alive! Lou, stow the galley! Doc, tie down those crates before they go over the side!', { style: 'shout', expr: 'serious' }),
  L('pip', 'On it! Oh no. Oh no no no.', { expr: 'scared', emote: 'sweat' }),
];

export const STORM_CRATE = [
  'Got it!', 'Tied down!', 'That’s the last one!',
];

export const STORM_ALL_TIED: BubbleLine[] = [
  L('crowe', 'Good work! Now get in here before you’re fish food!', { style: 'shout', expr: 'serious' }),
];

export const STORM_CLIMAX: BubbleLine[] = [
  L('rowan', 'Crowe... there’s something in the water.', { expr: 'scared', emote: 'shock', auto: 1600 }),
  L('rowan', 'Something BIG.', { style: 'shout', expr: 'shocked', auto: 1300 }),
  L('crowe', 'Never mind the water! Look UP!', { style: 'shout', expr: 'shocked', emote: 'alarm', auto: 1500 }),
  L('crowe', 'HOLD ON TO SOMETHING!', { style: 'shout', expr: 'scared', auto: 1400 }),
];

// ==================================================================== SHORE

export const WAKE_UP: BubbleLine[] = [
  L('rowan', '...', { style: 'think', expr: 'tired', auto: 1200 }),
  L('rowan', 'Sand. Why is there... sand?', { style: 'think', expr: 'tired' }),
];

export const SEE_WRECK: BubbleLine[] = [
  L('rowan', 'The Kittiwake...', { expr: 'sad', emote: 'shock' }),
];

export const CREW_ASHORE: BubbleLine[] = [
  L('crowe', 'Sound off! Doc?!', { style: 'shout', expr: 'worried' }),
  L('rowan', 'Here! I’m okay! I think!', { expr: 'worried', react: 'jump' }),
  L('crowe', 'Pip?!', { style: 'shout', expr: 'worried' }),
  L('pip', 'Here! I think I swallowed a fish!', { expr: 'shocked', emote: 'sweat', react: 'bounce' }),
  L('crowe', 'Lou?', { expr: 'worried' }),
  L('crowe', '...Lou?!', { style: 'shout', expr: 'scared', emote: 'sweat' }),
  L('lou', 'I saved the pot!', { expr: 'happy', emote: 'sparkle', react: 'jump', others: { crowe: { expr: 'laugh', emote: 'laugh' }, pip: { expr: 'laugh', emote: 'laugh' }, rowan: { expr: 'laugh' } } }),
  L('crowe', 'Course you did.', { expr: 'happy' }),
  L('crowe', 'Right. The Kittiwake’s done for. Hull split like a kipper, and the radio’s drowned.', { expr: 'serious' }),
  L('pip', 'I can fix the radio! Probably! With parts. That we don’t have.', { expr: 'worried' }),
  L('crowe', 'Then we make camp. Dark in a few hours, and I don’t fancy finding out what lives in that jungle.', { expr: 'serious', others: { rowan: { expr: 'worried' } } }),
  L('lou', 'I’ll find us something to eat. Something that doesn’t eat us first.', { expr: 'determined' }),
  L('crowe', 'Doc, you’re the one with the camping badge. Salvage what you can from the wreck and get a tent up.', { expr: 'neutral' }),
  L('rowan', 'On it.', { expr: 'determined', react: 'nod' }),
];

export const CAMP_BARK = {
  canvas: 'Soaked, but it’ll dry.',
  poles: 'Tent poles! Only a bit bent.',
  hammer: 'Found the hammer!',
  firstSample: 'This fern’s underside is silver. Nothing like it back home.',
  full: 'My backpack is full.',
};

export const CROWE_ROPE: BubbleLine[] = [
  L('crowe', 'You’ll want rope for the guy lines. Flax, Doc: those big sword-leaf bushes by the treeline.', { expr: 'neutral' }),
  L('crowe', 'Cut the leaves, strip the fibre at the bench, twist it. My gran could do it with her eyes shut.', { expr: 'happy' }),
];

export const TENT_BUILT: BubbleLine[] = [
  L('crowe', 'Not bad. Lopsided. But not bad.', { expr: 'teasing' }),
  L('lou', 'It’s beautiful, sweetheart.', { expr: 'happy', emote: 'heart' }),
  L('pip', 'Ooh! Can I put the laptop in there? It’s the only dry place on this whole beach!', { expr: 'happy', emote: 'idea' }),
];

export const FIRE_BUILT: BubbleLine[] = [
  L('lou', 'Fire! Now we’re civilised.', { expr: 'happy', emote: 'sparkle' }),
  L('crowe', 'Now we’ve got a beacon too. Anybody out there’ll see it.', { expr: 'neutral' }),
];

export const LAPTOP_READY: BubbleLine[] = [
  L('pip', 'I saved your laptop! It was in a dry bag, in a cooler, in a crate. I’m a genius.', { expr: 'smug', emote: 'sparkle' }),
  L('pip', 'I rigged a charger off the Kittiwake’s batteries. Analyse your samples in the tent: that’s how we learn what this place is.', { expr: 'happy' }),
];

export const FIRST_ANALYSIS: BubbleLine[] = [
  L('pip', 'See? Science! Research points! I made that up, but it sounds official.', { expr: 'happy' }),
  L('pip', 'Spend them in the Skills app. I can upgrade anything if you tell me what to aim for.', { expr: 'determined' }),
];

export const DUSK: BubbleLine[] = [
  L('crowe', 'That’ll do for today. Get some sleep, Doc. We’ll figure out tomorrow, tomorrow.', { expr: 'tired' }),
];

// ==================================================================== NIGHT: SOMETHING IN THE DARK

export const NOISE_WAKE: BubbleLine[] = [
  L('rowan', '...Crowe? Is that you?', { style: 'whisper', expr: 'worried', emote: 'question' }),
  L('rowan', 'Okay. It’s probably a possum. A normal-sized possum.', { style: 'whisper', expr: 'scared', emote: 'sweat' }),
];

export const NOISE_OUTSIDE: BubbleLine[] = [
  L('rowan', 'Hello...?', { style: 'whisper', expr: 'scared' }),
];

export const JUMPSCARE: BubbleLine[] = [
  L('rowan', 'AAAAAAH!', { style: 'shout', expr: 'shocked', emote: 'shock', auto: 900 }),
  L('aroha', 'Kāti! Ko wai koe?!', { style: 'shout', expr: 'angry', emote: 'anger' }),
  L('rowan', 'D-don’t— I’m, uh— friendly! Friendly scientist!', { expr: 'scared', react: 'tremble' }),
  L('aroha', 'He aha tāu mahi i konei?', { expr: 'serious' }),
  L('rowan', 'Translator, translator, where’s the translator...', { style: 'think', expr: 'scared', emote: 'sweat' }),
  L('phone', '“WHAT IS... YOUR WORK... HERE?”', { style: 'phone' }),
  L('rowan', 'Tell her we crashed. Shipwreck. We’re not dangerous!', { expr: 'worried' }),
  L('phone', '“WE ARE... BOAT... BROKEN. WE ARE NOT... DELICIOUS.”', { style: 'phone' }),
  L('aroha', '...Delicious?', { expr: 'teasing', emote: 'question' }),
  L('rowan', 'No! No no no. Dangerous! Not delicious! I mean, not dangerous!', { expr: 'shocked', emote: 'sweat', react: 'shake' }),
  L('phone', '“BATTERY LOW.”', { style: 'phone' }),
  L('rowan', '...', { expr: 'sad', emote: 'gloom' }),
  L('aroha', 'Hahaha! Kia ora. You can put the phone away. It was butchering my language.', { expr: 'laugh', emote: 'laugh', react: 'bounce' }),
  L('rowan', 'You speak English?!', { expr: 'shocked', emote: 'interrobang', react: 'jump' }),
  L('aroha', 'Better than your phone speaks Māori.', { expr: 'smug' }),
  L('aroha', 'I’m Aroha. I watched your boat hit the rocks. I figured whoever survived would be very lucky or very stupid.', { expr: 'teasing' }),
  L('rowan', 'Which one are we?', { expr: 'worried' }),
  L('aroha', 'You pitched your tent right next to a delver colony. Stupid. You survived that storm. Lucky.', { expr: 'teasing', emote: 'sparkle' }),
  L('crowe', 'What in blazes is all the screaming— oh. Who’s this, then?', { expr: 'grumpy', emote: 'question' }),
  L('aroha', 'The one who’s going to keep you alive. You have no idea what lives out there.', { expr: 'serious' }),
  L('crowe', '...Right. I’ll put the kettle on.', { expr: 'neutral' }),
];

export const MORNING_AROHA: BubbleLine[] = [
  L('lou', 'A guest for breakfast! Sit, sit!', { expr: 'happy', emote: 'heart' }),
  L('aroha', 'Is that... stew? For breakfast?', { expr: 'surprised' }),
  L('lou', 'Stew is for any time.', { expr: 'smug' }),
  L('aroha', 'I like her.', { expr: 'happy' }),
  L('pip', 'Do you live here? Are there more of you? How is there a whole continent nobody knows about? Have you seen a snake with legs?', { expr: 'happy', emote: 'interrobang', speed: 1.6 }),
  L('aroha', 'Yes. Yes. Long story. And... look behind you.', { expr: 'teasing' }),
  L('pip', 'AAAH! LEGS! IT HAS LEGS!', { style: 'shout', expr: 'shocked', emote: 'shock', react: 'jump', others: { aroha: { expr: 'laugh', emote: 'laugh' }, crowe: { expr: 'laugh' } } }),
  L('aroha', 'That’s just a strider. It likes you.', { expr: 'happy' }),
  L('aroha', 'My whānau have fished this coast for generations. We keep to ourselves.', { expr: 'neutral' }),
  L('aroha', 'The land here is not like anywhere else. It has been waiting a long time for someone who wants to understand it.', { expr: 'serious' }),
  L('rowan', 'Then let me try. Will you show me?', { expr: 'determined', choices: ['Will you show me?', 'I promise I’ll listen.'] }),
  L('aroha', 'I’ll show you. But when I say run, you run.', { expr: 'smug' }),
  L('aroha', 'Here, I drew you a map. My map. The best one on the island.', { expr: 'happy', emote: 'sparkle' }),
];

// ==================================================================== CAMP (ongoing)

/** Crowe at camp: story progression reports + side quests + chatter. Returns lines and an optional effect. */
export function campTalk(who: string): { lines: BubbleLine[]; after?: () => void } {
  const s = game.save;
  // --- main story reports
  const rep = reportFor(who);
  if (rep) return rep;
  // --- side quest turn-ins
  const turn = turnIn(who);
  if (turn) return turn;
  // --- offers
  const offers = offerable(who as 'crowe');
  if (offers.length) {
    const q = offers[0];
    return { lines: offerLines(q.id), after: () => startQuest(q.id) };
  }
  // --- chatter
  return { lines: [chatter(who)] };
  void s;
}

function reportFor(who: string): { lines: BubbleLine[]; after?: () => void } | null {
  const s = game.save;
  const st = (id: string) => questStatus(id);
  const seenN = Object.keys(s.seen).length;
  if (who === 'crowe' && st('contact') === 'active' && s.flags['visit:fernwood'] && seenN >= 3 && !s.flags['report:contact']) return {
    lines: [
      L('rowan', 'Crowe! Legs! Snakes with legs! And a colony of little diggers with sentinels, and—', { expr: 'happy', emote: 'sparkle', react: 'bounce' }),
      L('crowe', 'Breathe, Doc.', { expr: 'teasing' }),
      L('aroha', 'Tomorrow I’ll take you up into the Emerald Canopy. The snakes up there fly.', { expr: 'smug' }),
      L('crowe', 'Snakes don’t fly.', { expr: 'grumpy' }),
      L('aroha', 'Here they do.', { expr: 'teasing', emote: 'sparkle' }),
    ],
    after: () => { s.flags['report:contact'] = true; unlock('canopy'); },
  };
  if ((who === 'crowe' || who === 'aroha') && st('canopy') === 'active' && s.seen.skyribbon && Object.keys(s.facts).length >= 3 && !s.flags['report:canopy']) return {
    lines: [
      L('crowe', 'Well? Did the snakes fly?', { expr: 'grumpy' }),
      L('rowan', 'They flattened their ribs into ribbons and GLIDED. Crowe, they glided.', { expr: 'happy', emote: 'sparkle' }),
      L('crowe', '...Blimey.', { expr: 'surprised', emote: 'exclaim' }),
      L('aroha', 'North of here, the river drops off the plateau. Thunder Falls. Birds nest in the cliffs, and the rocks smell of snake.', { expr: 'serious' }),
    ],
    after: () => { s.flags['report:canopy'] = true; unlock('falls'); },
  };
  if (st('falls') === 'active' && s.clues['giant-skin'] && !s.flags['report:falls']) return {
    lines: [
      L('rowan', 'There was a shed skin at the falls. It was the size of a bus.', { expr: 'shocked' }),
      L('aroha', '...It went south, didn’t it?', { expr: 'serious' }),
      L('rowan', 'Toward the Blackwater Mangroves. How did you know?', { expr: 'worried', emote: 'question' }),
      L('aroha', 'Because that’s where the big one lives. We don’t fish the Blackwater. Ever.', { expr: 'serious' }),
      L('crowe', 'Then you stay hidden, Doc. Photos from a distance. Promise me.', { expr: 'worried' }),
      L('pip', 'I made you something! It’s a lure that smells like a crocodile’s armpit. For distractions!', { expr: 'happy', emote: 'idea' }),
    ],
    after: () => { s.flags['report:falls'] = true; unlock('mangrove'); },
  };
  if (st('titan') === 'active' && s.seen.titan && !s.flags['report:titan']) return {
    lines: [
      L('rowan', 'It was real. Sixteen metres of snake. It swallowed a crocodile whole.', { expr: 'shocked', emote: 'sweat' }),
      L('lou', 'A whole crocodile?! Sit down, sweetheart, you’re shaking.', { expr: 'worried' }),
      L('crowe', 'And it’s not the biggest thing here. I saw a fin in that storm. So did you.', { expr: 'serious' }),
      L('pip', 'I can patch the Kittiwake’s old dive suit! I need scrap metal and rope. Then you can go and say hi to it!', { expr: 'determined' }),
      L('rowan', 'Say hi to it. Right.', { expr: 'worried' }),
    ],
    after: () => { s.flags['report:titan'] = true; },
  };
  if (who === 'pip' && st('deep') === 'active' && !s.flags['divegear']) {
    if (count('scrap') >= 4 && count('rope') >= 2) return {
      lines: [
        L('pip', 'That’s everything! Give me an hour and a lot of duct tape.', { expr: 'happy', emote: 'sparkle' }),
        L('pip', 'Done! It only leaks a little!', { expr: 'smug', react: 'bounce' }),
      ],
      after: () => { remove('scrap', 4); remove('rope', 2); s.flags['divegear'] = true; unlock('coast'); game.ui.toast('Received: <b>Patched dive gear</b>. The Serpent Coast is on the map.', 'GEAR', 'teal', 4200); },
    };
    return { lines: [L('pip', 'I need 4 scrap metal and 2 rope for the dive suit. The wreck’s got plenty of scrap!', { expr: 'determined' })] };
  }
  if (st('deep') === 'active' && s.seen.leviathan && !s.flags['report:deep']) return {
    lines: [
      L('rowan', 'Crimson gill fronds. Feathered gills on a twenty-five-metre serpent. It looked right at me.', { expr: 'happy', emote: 'sparkle' }),
      L('aroha', 'Then it’s decided you’re interesting. That’s rare.', { expr: 'smug' }),
      L('crowe', 'So that’s what hit us in the storm. Not the wave. That.', { expr: 'serious' }),
      L('rowan', 'There’s so much left to understand. Every animal here tells a story about the others.', { expr: 'determined' }),
      L('aroha', 'Then keep listening, Doc.', { expr: 'happy' }),
    ],
    after: () => { s.flags['report:deep'] = true; },
  };
  return null;
}

function unlock(site: 'canopy' | 'falls' | 'mangrove' | 'coast') {
  const s = game.save;
  if (!s.sites.includes(site)) {
    s.sites.push(site);
    const names = { canopy: 'Emerald Canopy', falls: 'Thunder Falls', mangrove: 'Blackwater Mangroves', coast: 'Serpent Coast' };
    game.ui.toast(`New place on Aroha’s map: <b>${names[site]}</b>`, 'MAP', 'teal', 4200);
  }
}

function offerLines(id: string): BubbleLine[] {
  const q = QUEST_BY_ID[id];
  switch (id) {
    case 'pipe': return [
      L('crowe', 'Doc. Don’t suppose you’ve seen a pipe? Briar, anchor on the bowl. Not that I care.', { expr: 'grumpy' }),
      L('crowe', 'I had it for thirty years, is all. Probably at the bottom of the sea.', { expr: 'sad', emote: 'gloom' }),
      L('rowan', 'I’ll look around the tide pools by the wreck.', { expr: 'happy' }),
    ];
    case 'kitchen': return [
      L('lou', 'Sweetheart, I can’t cook with seawater and ship biscuits forever.', { expr: 'worried' }),
      L('lou', 'Bring me 3 moonfruit, 2 kawakawa leaves and a shelf fungus off a trunk, and I’ll make you something special.', { expr: 'happy' }),
    ];
    case 'glow': return [
      L('pip', 'Your phone torch won’t last. Bring me 3 glowcaps and I’ll build you a proper headlamp. Bioluminescent! Rechargeable! Probably!', { expr: 'happy', emote: 'idea' }),
    ];
    case 'radio': return [
      L('pip', 'If we build a radio mast from the wreck, I can reach the mainland. We need scrap, rope, copper wire from the wheelhouse, and a battery.', { expr: 'determined' }),
    ];
    case 'snares': return [
      L('aroha', 'My uncle ran snare lines through the Fernwood, years ago. Pests, mostly. Some snares are still out there.', { expr: 'neutral' }),
      L('aroha', 'Animals leave fur and feathers on them. Check them for me? They’re marked on the map.', { expr: 'happy' }),
    ];
    case 'tracks': return [
      L('aroha', 'You look at the animals. Look at what they leave behind. Tracks, droppings, shed skins, feathers.', { expr: 'serious' }),
      L('aroha', 'Find me four signs, and I’ll teach you to read them.', { expr: 'smug' }),
    ];
    case 'hawk': return [
      L('crowe', 'Watched a gale hawk take a snake right off a branch from the wheelhouse once. Nobody believed me.', { expr: 'grumpy' }),
      L('crowe', 'Get me a photo of one diving, Doc. For the logbook.', { expr: 'neutral' }),
    ];
    case 'snacker': return [
      L('lou', 'Something keeps stealing my moonfruit at night! Little quills everywhere.', { expr: 'angry', emote: 'anger' }),
      L('lou', 'I want a photo of the thief, eating my fruit. For evidence.', { expr: 'determined' }),
    ];
  }
  return [L(q.giver, q.desc)];
}

function turnIn(who: string): { lines: BubbleLine[]; after?: () => void } | null {
  const s = game.save;
  const active = (id: string) => questStatus(id) === 'active';
  if (who === 'crowe' && active('pipe') && count('pipe') >= 1) return {
    lines: [
      L('rowan', 'Found something in the tide pools...', { expr: 'happy' }),
      L('crowe', '...That’s my pipe.', { expr: 'surprised', emote: 'exclaim' }),
      L('crowe', 'Doc, I... Thank you.', { expr: 'happy', emote: 'heart' }),
      L('crowe', 'Here. My old binoculars. You’ll get more use out of them than me.', { expr: 'neutral' }),
    ],
    after: () => { remove('pipe', 1); s.flags['pipe:returned'] = true; },
  };
  if (who === 'lou' && active('kitchen') && count('moonfruit') >= 3 && count('kawakawa') >= 2 && count('bracket') >= 1) return {
    lines: [
      L('lou', 'Look at all this! Oh, I can do things with this.', { expr: 'happy', emote: 'sparkle' }),
      L('lou', 'From now on I cook proper island food. Come to the campfire when you want stew or tea.', { expr: 'happy' }),
    ],
    after: () => { remove('moonfruit', 3); remove('kawakawa', 2); remove('bracket', 1); s.flags['kitchen'] = true; },
  };
  if (who === 'pip' && active('glow') && count('glowcap') >= 3) return {
    lines: [
      L('pip', 'Glowcaps! Look at them glow! Okay, give me a sec...', { expr: 'happy', emote: 'sparkle' }),
      L('pip', 'Ta-da! A headlamp! Night trips unlocked. Don’t lick it.', { expr: 'smug', react: 'bounce' }),
    ],
    after: () => { remove('glowcap', 3); s.flags['glow:done'] = true; },
  };
  if (who === 'pip' && active('radio') && buildDone('radio') && !s.flags['radio:talked']) return {
    lines: [
      L('pip', 'Listen!', { expr: 'happy' }),
      L('pip', '...Static. Beautiful, beautiful static. Somebody out there could hear us now.', { expr: 'happy', emote: 'music' }),
      L('crowe', 'Maybe they will. Maybe we’ll let them.', { expr: 'neutral' }),
    ],
    after: () => { s.flags['radio:talked'] = true; },
  };
  if (who === 'aroha' && active('snares') && (s.vars['snares'] ?? 0) >= 3) return {
    lines: [
      L('aroha', 'Fur, feathers... and a quillhog quill. Uncle would be proud.', { expr: 'happy' }),
      L('aroha', 'Here’s a trick: heel first, weight slow, never step on what you can’t see.', { expr: 'serious' }),
    ],
    after: () => { s.flags['snares:done'] = true; },
  };
  if (who === 'aroha' && active('tracks') && Object.keys(s.clues).length >= 4) return {
    lines: [L('aroha', 'Now you’re reading the land. Ka pai.', { expr: 'happy', emote: 'sparkle' })],
    after: () => { s.flags['tracks:done'] = true; },
  };
  if (who === 'crowe' && active('hawk') && (s.evPhoto['galehawk:diving'] || s.evVideo['galehawk:diving'])) return {
    lines: [L('crowe', 'Ha! There! I TOLD them. Going in the logbook, that is.', { expr: 'laugh', emote: 'laugh' })],
    after: () => { s.flags['hawk:done'] = true; },
  };
  if (who === 'lou' && active('snacker') && (s.evPhoto['quillhog:eating'] || s.evVideo['quillhog:eating'])) return {
    lines: [L('lou', 'The little thief! Look at its face. Oh, I can’t even be angry.', { expr: 'happy', emote: 'heart' })],
    after: () => { s.flags['snacker:done'] = true; },
  };
  return null;
}

function chatter(who: string): BubbleLine {
  const s = game.save;
  const lines: Record<string, BubbleLine[]> = {
    crowe: [
      L('crowe', 'Kettle’s on.', { expr: 'neutral' }),
      L('crowe', 'Forty years at sea and I get shipwrecked by a puddle.', { expr: 'grumpy' }),
      L('crowe', 'That Aroha knows her tides. Better than me. Don’t tell her I said that.', { expr: 'neutral' }),
      L('crowe', 'You look after yourself out there, Doc.', { expr: 'serious' }),
    ],
    lou: [
      L('lou', 'Eat something before you go!', { expr: 'happy' }),
      L('lou', 'Pip ate a raw grub today. On purpose. I’ve failed her.', { expr: 'sad' }),
      L('lou', '♪ Hmm hm hmm... ♪', { expr: 'happy', emote: 'music' }),
    ],
    pip: [
      L('pip', 'If I had a soldering iron, I’d have a soldering iron.', { expr: 'thinking' }),
      L('pip', 'I’m cataloguing every screw on the wreck. There are 4,011. I have names for 30.', { expr: 'happy' }),
      L('pip', 'Research points, Rowan! Upgrades need research points!', { expr: 'determined' }),
    ],
    aroha: [
      L('aroha', 'Kia ora, Doc.', { expr: 'happy' }),
      L('aroha', 'Move slowly, stay downwind, and let them get used to you. The best photos come to the patient.', { expr: 'serious' }),
      L('aroha', 'Crowe snores like a boneface.', { expr: 'teasing' }),
      L('aroha', `You’ve met ${Object.keys(s.seen).length} of the animals here. There are ${SPECIES.length} I know of. Maybe more.`, { expr: 'smug' }),
    ],
  };
  return pick(lines[who] ?? [L(who, '...')]);
}

// ==================================================================== EXPEDITION barks (Aroha as guide)

export function arohaSpots(species: string): string | null {
  const t: Record<string, string[]> = {
    delver: ['Shh. Delvers. Watch the sentinel: if it squeaks, they all vanish.', 'Stay still and they’ll forget you’re here.'],
    strider: ['A strider. Curious things. Keep still and it might come to you.'],
    sprinter: ['Sprint viper. Back away slowly, Doc. Slowly.', 'Don’t run from that one. It likes it when things run.'],
    boneface: ['Bonefaces. Gentle, until you get near the calves.', 'See the little ones? Keep your distance from them.'],
    flicker: ['A flicker! They hunt snakes. If you see one stalking, get your camera ready.'],
    shieldback: ['Shieldback. If you startle it, it’ll roll into a ball.'],
    quillhog: ['Quillhog. Don’t get behind it. Trust me.'],
    galehawk: ['Gale hawk, up high. If it folds its wings, something down here is about to have a bad day.'],
    nutcracker: ['Nutcrackers. One of them is always on watch. See it?'],
    mossfrog: ['Hear that? Moss frogs. Good luck finding one.'],
    barkgecko: ['Check the trunks. Bark geckos.'],
    titan: ['...Doc. Don’t move. Don’t breathe.'],
    ironjaw: ['Eyes on the water. That’s an ironjaw. Not one step closer to the edge.'],
    hunterbat: ['Hunter bats hunt on foot. Watch the ground, not the sky.'],
    monarch: ['The Monarch! Look up! My grandmother called them the kings of the wind.'],
    cragauk: ['Auks nest up on the cliff. If a crag viper comes, they’ll mob it.'],
    snakestork: ['Thunder stork. Watch it hunt. It’s faster than it looks.'],
  };
  const a = t[species];
  return a ? pick(a) : null;
}

export const AROHA_TRAVEL: Record<string, string[]> = {
  fernwood: ['We follow the stream into the ngāhere, the forest. Watch your feet: things live under the leaves.', 'Keep to the ridge; the gully floods when it rains.', 'Here. The Fernwood. Speak softly.'],
  canopy: ['Up the old track to the plateau. The trees there are older than anyone’s memory.', 'We climb from here. Don’t look down.', 'The Emerald Canopy. The snakes fly here.'],
  falls: ['North along the awa, the river, up toward the cliffs.', 'Hear that roar? Thunder Falls.', 'The auks nest in the cliff. Mind the spray.'],
  mangrove: ['South, where the river spreads into the delta. I don’t come here often.', 'The water is dark here. Stay on the roots.', 'The Blackwater. Quietly now.'],
  coast: ['Around the headland to the reef. The moana, the sea, is clear as glass here.', 'Pip says the suit only leaks a little.', 'The Serpent Coast. It’s waiting for you.'],
  camp: ['Back along the beach to camp.', 'Lou will have something on the fire.', 'Home, for now.'],
};
