// V11 NPCs: who the new people are (the social registry), what they make of gifts, and what they talk
// about. Every conversation changes with how well they know Mori (tiers from social.ts) and with the
// story (side quests, the Helix question, the romance with whoever Mori chose, if anyone).
//
//   Hine Parata (46)      senior ranger at Te Puni station: dry, organised, unflappable, kind under it
//   Doug McKenzie (52)    her husband, ranger and hopeless birder: puns, songs, a soft heart
//   Rosie (9)             their daughter, Junior Ranger: fearless, a thousand questions, Chunk's best friend
//   Dr Celeste Varga (36) Helix's lead scientist: brilliant, competitive, defensive; was a field
//                         biologist before she was a manager
//   Teo Lindqvist (27)    Helix's field tech: a gentle giant, awkward, loves animals, bakes; uneasy about
//                         the company. A romance option
//   Rua Hēnare (61)       a trapper in the hills: laconic, gruff, hates waste, protects the ground birds
//   Sunny Faleolo (29)    his apprentice: big laugh, competitive at everything, the best cook in the
//                         hills. A romance option
//   Tīpene Karaka (68)    master carver from up the coast: patient, cheeky, talks to timber
//   Ngaio Rāwhiti (31)    weaver who works salvage into harakeke: chatty, a perfectionist, hums
//   Marge Holloway (74)   retired naturalist hermit of the palm grove: eccentric, sharp, delighted

import { definePerson, defineTalk, tier, memo, setMemo, partner, romanceStage, hasMet } from '../social';
import type { TalkLine } from '../social';
import { questStatus } from '../../quests';
import { F, day } from './state';

type T = [string, string, string?];
const lines = (c: T[]): TalkLine[] => c.map(([who, text, expr]) => ({ who, text, expr: expr ?? 'neutral' }));

interface TalkBook {
  /** the first conversation ever */
  intro: T[];
  /** a rotation of chats per tier (0 acquaintance .. 3 dear friend) */
  tiers: T[][][];
  /** story beats: the first that fits and hasn't been said */
  story?: { key: string; when: () => boolean; c: T[] }[];
  /** when they're Mori's partner */
  partner?: T[][];
  /** while the romance is growing (stage 1-2) */
  sweet?: T[][];
}
function book(id: string, b: TalkBook) {
  defineTalk(id, () => {
    if (!memo(id, 'intro')) { setMemo(id, 'intro', day()); return lines(b.intro); }
    for (const s of b.story ?? []) {
      if (memo(id, 's:' + s.key)) continue;
      let ok = false;
      try { ok = s.when(); } catch { ok = false; }
      if (ok) { setMemo(id, 's:' + s.key, day()); return lines(s.c); }
    }
    const n = memo(id, 'n');
    setMemo(id, 'n', n + 1);
    if (partner() === id && b.partner?.length && n % 2 === 0) return lines(b.partner[(n / 2) % b.partner.length]);
    if (romanceStage(id) > 0 && romanceStage(id) < 3 && b.sweet?.length && n % 3 === 0) return lines(b.sweet[(n / 3) % b.sweet.length]);
    // the highest tier's chats, falling back a tier now and then so old favourites come round again
    const t = tier(id);
    const pool = b.tiers[Math.min(t, b.tiers.length - 1)].length && (n % 4 !== 3 || t === 0) ? b.tiers[Math.min(t, b.tiers.length - 1)] : b.tiers[Math.max(0, t - 1)];
    return lines(pool[n % pool.length]);
  });
}
const done = (q: string) => questStatus(q) === 'done';
const active = (q: string) => questStatus(q) === 'active';

// ================================================================== the ranger station
definePerson({
  id: 'hine', name: 'Hine', group: 'ranger', adult: true, age: 46, role: 'Senior ranger, Te Puni station', color: '#44582a', home: 'isle-track', where: 'The ranger station on the bush track',
  blurb: 'Runs the station, the trap lines and her family with the same clipboard. Storms do not impress her.',
  loves: ['tea', 'vil_tea', 'dish_fishstew', 'dish_chowder'], likes: ['rope', 'wood', 'kawakawa', 'v10_fish', 'vil_kumara', 'kind:food'], dislikes: ['scrap', 'bug_hornet'], hates: ['dropping'],
  giftLines: {
    love: ['Tea. Proper tea. Mori, you have just become my favourite scientist.', 'Is that... a hot meal I didn’t cook? Sit down. You’re family now.'],
    like: ['That’ll get used. Everything at this station gets used. Cheers.', 'Good. Practical. I like practical.'],
    neutral: ['Right. I’ll put it on the shelf. When we have a shelf.', 'Thanks. I think.'],
    dislike: ['I have a whole station full of broken things already, love.', 'That’s... going straight in the bin. Kindly meant, though.'],
    hate: ['Mori. Put that down and wash your hands. Both of them.'],
  },
});
book('hine', {
  intro: [
    ['hine', 'Well, look at that. A real live castaway. You’ll be the scientist Aroha told me about.', 'happy'],
    ['hine', 'Hine Parata. Senior ranger, Te Puni station. Or what the storm left of it.', 'neutral'],
    ['mori', 'Mori. Your roof’s in the creek.', 'surprised'],
    ['hine', 'Our roof is in the creek, our radio is up a tree, and my husband is up a different tree looking at a bird. Welcome to the station.', 'teasing'],
  ],
  tiers: [
    [
      [['hine', 'Three rules at my station: tell someone where you’re going, take your rubbish home, and never feed Doug after dark.', 'serious'], ['mori', 'What happens if you feed Doug after dark?', 'thinking'], ['hine', 'He sings.', 'grumpy']],
      [['hine', 'We were on the far side of the island checking the trap line when the storm came through. Three days in a cave with a nine-year-old.', 'tired'], ['hine', 'I have heard every knock-knock joke ever told. Twice.', 'grumpy']],
      [['hine', 'This island is a sanctuary. The birds here have never met a rat. Let’s keep it that way.', 'serious']],
    ],
    [
      [['hine', 'Rosie talks about you all day. “Mori says this, Mori photographed that.” You’re a bad influence. Keep it up.', 'happy']],
      [['hine', 'Twenty-two years a ranger. You know what the job really is? Counting things in the rain.', 'teasing'], ['mori', 'Same as mine, then.', 'happy'], ['hine', 'Then we’re colleagues. Sit. There’s tea, if the billy’s not in the creek too.', 'happy']],
      [['hine', 'Aroha’s whānau looked after this place long before there was a station. I just do the paperwork.', 'neutral'], ['hine', 'Listen to her about the bush. She knows it like her own hand.', 'serious']],
    ],
    [
      [['hine', 'I wanted to be a pilot, you know. Then I saw a kākāpō in a box on the way to an island and that was that.', 'thinking'], ['mori', 'A pilot ranger. You’d have been terrifying.', 'happy'], ['hine', 'I AM terrifying. Ask Doug.', 'teasing']],
      [['hine', 'When you go out, take the trail markers. Every time. If you don’t come home, I want to know which way to look.', 'serious'], ['mori', 'You’d come looking?', 'surprised'], ['hine', 'Course I would. You’re one of mine now.', 'happy']],
    ],
    [
      [['hine', 'Doug and I met on a beach like yours. He was counting penguins, wrong. I corrected him. Twenty years later he still counts wrong.', 'happy'], ['hine', 'Find someone who annoys you that well, Mori. It’s the whole trick.', 'teasing']],
      [['hine', 'When the supply boat comes, I’m putting your name in the report. “Assisted the station beyond all reasonable expectation.”', 'happy'], ['mori', 'That’s very formal.', 'happy'], ['hine', 'It’s the nicest thing I’ve ever written. Don’t tell anyone.', 'teasing']],
    ],
  ],
  story: [
    { key: 'roofDone', when: () => done('q_roof'), c: [['hine', 'Radio’s working, roof’s on, and the kettle is ALSO on. First time since the storm. Thank you, Mori.', 'happy'], ['hine', 'The district office says hello, by the way. They want to know who you are. I said: a friend of the station.', 'happy']] },
    { key: 'helix', when: () => F('n:helix:met'), c: [['hine', 'You’ve met the Helix lot. Bioprospectors. They have a permit for “surveys”. Sample tags on our trees isn’t a survey.', 'grumpy'], ['hine', 'If you can talk sense into them, do. I’m too cross to try.', 'serious']] },
    { key: 'partner', when: () => !!partner() && tier('hine') >= 1, c: [['hine', 'Rosie tells me you’re walking out with someone. Don’t look like that, it’s a small island and she is a very efficient spy.', 'teasing'], ['hine', 'Good for you. Be kind to each other. That’s all the advice I’ve got.', 'happy']] },
  ],
});

definePerson({
  id: 'doug', name: 'Doug', group: 'ranger', adult: true, age: 52, role: 'Ranger and birder, Te Puni station', color: '#8a5a2a', home: 'isle-track', where: 'The ranger station, usually up a tree',
  blurb: 'Glasgow-born, island-made. Knows every bird call on the coast and every terrible pun in the English language.',
  loves: ['feather', 'berry_gold', 'dish_compote', 'dish_porridge'], likes: ['berry_ember', 'berry_dusk', 'moonfruit', 'kind:insect', 'tea'], dislikes: ['v10_fish', 'mussel', 'pipi', 'dish_grilledfish'], hates: ['dish_grubfry'],
  giftLines: {
    love: ['A feather! Look at the barbs on that. You’ve made an old birder very happy, son.', 'Och, that’s braw. That’s really braw. Thank you.'],
    like: ['Ta very much! I’ll have that with my tea. Everything goes with tea.', 'Lovely. Lovely! Hine, look what Mori brought!'],
    neutral: ['Oh. A {item}. Well, it’s the thought that counts, and that was a thought.'],
    dislike: ['Ah, I don’t eat anything with a face, son. Not even a small face. Kind of you though.', 'I’ll... pass that on to Hine.'],
    hate: ['Is that GRUBS? Fried grubs? Mori. I am a peaceful man. Take them away.'],
  },
});
book('doug', {
  intro: [
    ['doug', 'Shh! Shhh. Up there. Second branch. A tūī. No. A tūī-cousin. Look at the throat! Two tufts!', 'excited'],
    ['doug', '...Oh! Hello. Sorry. Doug McKenzie, ranger, husband of the boss, very pleased to meet you.', 'happy'],
    ['mori', 'Mori. I’m a field biologist.', 'happy'],
    ['doug', 'A BIOLOGIST. Hine! HINE! He’s a biologist! Finally, someone to argue about tail feathers with!', 'excited'],
  ],
  tiers: [
    [
      [['doug', 'You know what I call a bird that’s afraid of heights?', 'happy'], ['mori', 'What?', 'thinking'], ['doug', 'Chicken. ...I’ll be here all week. We all will, the boat’s not due.', 'laugh']],
      [['doug', 'Most of the birds on this island can’t fly. Nothing to fly from, see. No rats, no stoats. They just... strolled about for a million years.', 'happy']],
      [['doug', 'I’m vegetarian, by the way. In case you were thinking of bringing me a fish. People keep bringing me fish.', 'serious']],
    ],
    [
      [['doug', 'Rosie’s your number one fan. I was her number one fan. I’ve been demoted to number two. Number two fan of my own daughter.', 'sad'], ['doug', '...It’s fine. I’m fine.', 'laugh']],
      [['doug', 'Hine thinks I sing too much. I think she listens too little. Twenty years, that argument.', 'teasing'], ['doug', '*sings* Oh the birds of Te Puni, they sing in the rain...', 'happy']],
    ],
    [
      [['doug', 'I came out here for six months, twenty-four years ago. Met a ranger who told me I was counting penguins wrong.', 'happy'], ['mori', 'Were you?', 'teasing'], ['doug', 'Aye. I still am. She married me anyway.', 'laugh']],
      [['doug', 'Your camera, Mori. Your photos. They’re going to change how people see this place. I hope you know that.', 'serious']],
    ],
    [
      [['doug', 'If you ever need a hand, or a song, or a terrible pun, you know where the station is. It’s the one with the roof now. Thanks to you.', 'happy']],
      [['doug', 'You’re a good lad, Mori. Hine says it too, when she thinks I’m asleep.', 'happy']],
    ],
  ],
  story: [
    { key: 'birds', when: () => done('q_birds'), c: [['doug', 'Three new birds in the log. THREE. I’ve been telling everyone. I’ve told the trees. I’ve told a rock.', 'excited']] },
  ],
});

definePerson({
  id: 'rosie', name: 'Rosie', group: 'ranger', adult: false, age: 9, role: 'Junior Ranger (self-appointed)', color: '#c8501e', home: 'isle-track', where: 'Anywhere there are bugs',
  blurb: 'Nine and three quarters. Wants to be a scientist, a ranger and a pirate. Chunk’s best friend.',
  loves: ['kind:shell', 'bug_jewelbeetle', 'driftglass', 'glasscrab'], likes: ['feather', 'berry_gold', 'kind:insect', 'eggshell'], dislikes: ['v10_fish', 'kawakawa', 'tea'], hates: ['dropping'],
  giftLines: {
    love: ['WHOA. For ME? This is going in my collection. In the GOOD box.', 'It’s SO SHINY. Mori. MORI. You’re the best scientist in the whole world.'],
    like: ['Cool! Thanks Mori!', 'I’m going to show Chunk. He won’t care but I’m going to show him.'],
    neutral: ['Um. Thanks? What is it for?'],
    dislike: ['Ew. It smells like Dad’s socks.', 'Mum says I have to say thank you. Thank you.'],
    hate: ['MORI. That is POO. I’m telling.'],
  },
});
book('rosie', {
  intro: [
    ['rosie', 'Are you the scientist? Mum said there’s a scientist. Are you? Is that your camera? Can I hold it? What’s in your bag?', 'excited'],
    ['mori', 'Yes, yes, carefully, and... mostly snacks.', 'happy'],
    ['rosie', 'I’m Rosie. I’m a Junior Ranger. I made the badge myself. Is that your DOG? Can I meet your dog?', 'excited'],
  ],
  tiers: [
    [
      [['rosie', 'Did you know a wētā can live for two years? I had one called Gerald. He lived for one week. I don’t want to talk about Gerald.', 'sad']],
      [['rosie', 'When I grow up I’m going to be a scientist AND a ranger AND a pirate.', 'excited'], ['mori', 'All three?', 'surprised'], ['rosie', 'A pirate ranger who does science. Obviously.', 'smug']],
      [['rosie', 'Why is the sea salty? Why don’t birds fall off branches when they sleep? Why does Dad sing?', 'thinking'], ['mori', 'Those are three really good questions.', 'happy'], ['rosie', 'I have a hundred more. I keep them in my hat.', 'happy']],
    ],
    [
      [['rosie', 'Chunk let me hold his paw. We’re best friends now. Don’t tell him I said that. He’s shy.', 'happy']],
      [['rosie', 'I found a beetle that was green AND gold. I let it go because Mum says they have families.', 'happy'], ['mori', 'That’s exactly what a scientist does.', 'happy'], ['rosie', 'I KNOW.', 'smug']],
    ],
    [
      [['rosie', 'Mori, are you going to go home when the boat comes?', 'sad'], ['mori', 'Someday, maybe. But I’d come back.', 'neutral'], ['rosie', 'Pinky promise. ...You have to do the finger. Okay. Good.', 'happy']],
    ],
    [
      [['rosie', 'I drew you. You’re the one with the big camera. The dog is Chunk. The blob is a tiger. Don’t worry, you won.', 'happy']],
    ],
  ],
  story: [
    { key: 'badge', when: () => done('q_junior'), c: [['rosie', 'I’m a REAL Junior Ranger now. Mum signed the form. It’s official. I outrank Dad on Tuesdays.', 'excited']] },
  ],
});

// ================================================================== Helix camp
definePerson({
  id: 'celeste', name: 'Dr Varga', group: 'researcher', adult: true, age: 36, role: 'Lead scientist, Helix Bioprospecting', color: '#b08c14', home: 'coast', where: 'The Helix camp on the Serpent Coast',
  blurb: 'Brilliant, impatient and always right, or so she says. She used to sit in the rain counting frogs too.',
  loves: ['smp_crystal', 'v10_obsidian', 'fos_ammonite', 'fos_tooth'], likes: ['kind:fungus', 'smp_hotwater', 'smp_sulfur', 'plt_lanterncap', 'tea'], dislikes: ['kind:food', 'feather'], hates: ['dropping', 'bug_hornet'],
  giftLines: {
    love: ['...An ammonite. A good one, too. Where did you... never mind. Thank you. Genuinely.', 'That is a beautiful specimen. I’ll log it with your name on it. That’s not nothing, from me.'],
    like: ['Interesting. I’ll have it looked at.', 'Hm. That’s useful, actually. Thank you.'],
    neutral: ['I’m not sure what you want me to do with this, Dr Mori.'],
    dislike: ['I don’t eat in the field. I barely eat in the office.', 'Please don’t give me things that are alive or used to be.'],
    hate: ['Is that a HORNET? In a JAR? Get it away from my samples.'],
  },
});
book('celeste', {
  intro: [
    ['celeste', 'You’re on a Helix survey site. This area is under permit.', 'serious'],
    ['mori', 'Permit from who? I’m Mori. Shipwrecked biologist. I’ve been following your boot prints for a week.', 'teasing'],
    ['celeste', 'Teo’s boot prints. Mine are smaller and go in straighter lines. Dr Celeste Varga. Helix Bioprospecting.', 'smug'],
    ['celeste', 'Shipwrecked. How... rustic. Don’t touch the tags.', 'neutral'],
  ],
  tiers: [
    [
      [['celeste', 'Every species on this island is a library of compounds nobody has read. Antibiotics. Enzymes. Somebody should read them.', 'serious'], ['mori', 'And sell them.', 'grumpy'], ['celeste', 'And SAVE people with them. Somebody pays for that.', 'angry']],
      [['celeste', 'Your “field office” has no budget, no lab and no boat. Mine has all three. Think about who’s going to protect this place.', 'smug']],
      [['celeste', 'Teo thinks I don’t sleep. I sleep. On Thursdays.', 'tired']],
    ],
    [
      [['celeste', 'I did my doctorate on cave frogs. Four years in the dark with a headlamp. I loved it.', 'thinking'], ['mori', 'What happened?', 'neutral'], ['celeste', 'Funding. Funding always happens.', 'sad']],
      [['celeste', 'Your photographs are... good. Clean. Behaviour, not just specimens. I used to take photos like that.', 'neutral']],
    ],
    [
      [['celeste', 'If Helix knew I was having tea with the competition, I’d be in trouble. Pour.', 'teasing']],
      [['celeste', 'I’ve been thinking about what you said. About the traps. About what we’re actually for.', 'thinking'], ['celeste', 'Don’t look so pleased. I said thinking.', 'grumpy']],
    ],
    [
      [['celeste', 'When this is over, I’m writing a paper on this island. A real one. Co-authored. Your name first. ...Don’t make it weird.', 'happy']],
    ],
  ],
  story: [
    { key: 'turned', when: () => done('q_tags'), c: [['celeste', 'Non-invasive sampling only. Swabs, shed skin, photographs. I sent the memo. Head office will hate it.', 'serious'], ['celeste', 'I find I don’t care very much. That’s new.', 'happy']] },
  ],
});

definePerson({
  id: 'teo', name: 'Teo', group: 'researcher', adult: true, romanceable: true, age: 27, role: 'Field technician, Helix Bioprospecting', color: '#a08010', home: 'coast', where: 'The Helix camp, or somewhere he shouldn’t be',
  blurb: 'Big boots, big pack, big heart. Bakes when he’s nervous, which is always. Not sure he likes his job.',
  loves: ['dish_porridge', 'dish_fritters', 'berry_gold', 'dish_flatbread', 'vil_rewena'], likes: ['kind:food', 'moonfruit', 'tea', 'feather'], dislikes: ['inkcap', 'smp_sulfur'], hates: ['bug_hornet'],
  giftLines: {
    love: ['Is this for me? Oh. Oh, wow. Nobody brings me things. I mean, they bring me equipment. This is better than equipment.', 'You remembered I like these. You... remembered. Thank you, Mori.'],
    like: ['Hey, thanks! I’ll share it. Well. I’ll mostly share it.', 'That’s really nice of you. Seriously.'],
    neutral: ['Oh! Thanks. What... what is it? It’s great. Whatever it is.'],
    dislike: ['Ah. That smells like the inside of my boots. Thanks, though!'],
    hate: ['Nope. No. I got stung by one of those on day two. My arm was the size of a ham.'],
  },
});
book('teo', {
  intro: [
    ['teo', 'Oh no. Oh no, you’re a person. Hi! Sorry. I haven’t seen a person who isn’t Dr Varga in... a while.', 'surprised'],
    ['teo', 'Teo. Lindqvist. Field tech. I carry things and put tags on stuff. Mostly I carry things.', 'happy'],
    ['mori', 'Mori. Big boots, zigzag tread?', 'teasing'],
    ['teo', 'Size fifteen. They’re the only ones that fit. I’ve been leaving prints all over your island, haven’t I. Sorry.', 'worried'],
  ],
  tiers: [
    [
      [['teo', 'I joined Helix because they said “field work in remote places”. I thought that meant, you know. Looking at things.', 'thinking'], ['teo', 'It mostly means putting things in tubes.', 'sad']],
      [['teo', 'I bake when I’m nervous. I’ve made eleven batches of skillet bread this week. On a camp stove.', 'worried'], ['mori', 'Are you nervous now?', 'teasing'], ['teo', 'I’m always nervous. Want some bread?', 'happy']],
      [['teo', 'Don’t tell Dr Varga, but I named the crab that lives under our water tank. His name’s Barry.', 'happy']],
    ],
    [
      [['teo', 'Back home there’s a lake. In winter it freezes and the whole town goes out on it. Skates, sledges, my mum’s cinnamon buns.', 'happy'], ['teo', 'Here it’s thirty degrees and something keeps eating my socks.', 'laugh']],
      [['teo', 'You know what I like about you? You look at a bird like it’s the bird’s island. Not like it’s a sample.', 'happy']],
    ],
    [
      [['teo', 'I’m thinking about quitting. When we get back. Doing something... I don’t know. Real. Like what you do.', 'thinking'], ['mori', 'You’d be good at it.', 'happy'], ['teo', 'You think? Huh. Okay. I’m going to think that too, then.', 'happy']],
      [['teo', 'I saved you the last skillet bread. I may have eaten half of it. On the way over. Sorry.', 'teasing']],
    ],
    [
      [['teo', 'This is going to sound weird, but... this island’s been the best months of my life. And I think that’s mostly because of you.', 'happy']],
    ],
  ],
  sweet: [
    [['teo', 'I keep thinking about that walk. The light on the water. You laughing at my boots.', 'happy'], ['teo', 'Sorry. That’s... I just keep thinking about it. Is all.', 'teasing']],
    [['teo', 'Hey. You. Hi. I’ve been practising saying hi normally. How was that?', 'happy'], ['mori', 'Very normal.', 'teasing'], ['teo', 'Great. Great. Nailed it.', 'laugh']],
  ],
  partner: [
    [['teo', 'I baked you something. It’s shaped like a heart. Well. It was. It fell over. It’s shaped like a... a potato. A loving potato.', 'happy']],
    [['teo', 'Dr Varga caught me smiling at nothing again. She said “Mori?” and I said “no” and she said “Mori.” She’s a scientist, she knows.', 'laugh']],
    [['teo', 'Whatever happens when the boat comes, I’m really glad it was you. That I met. On an island. In big boots.', 'happy']],
  ],
  story: [
    { key: 'tagsDone', when: () => done('q_tags'), c: [['teo', 'She changed the protocol. No more live traps. I almost cried. I did cry. In the tent. Quietly.', 'happy'], ['teo', 'Thank you, Mori. You did that.', 'happy']] },
  ],
});

// ================================================================== the hills
definePerson({
  id: 'rua', name: 'Rua', group: 'hunter', adult: true, age: 61, role: 'Trapper, Ngā Puke Kōhatu', color: '#22466e', home: 'hills', where: 'The trappers’ camp in the Rocky Hills',
  blurb: 'Has spent forty years walking these hills with a trap line and a knife. Speaks rarely. Means all of it.',
  loves: ['dish_grilledfish', 'wire', 'dish_boilup', 'v10_fish'], likes: ['rope', 'flint', 'stone', 'wood', 'tea'], dislikes: ['dish_compote', 'berry_gold'], hates: ['scentlure', 'dish_charred'],
  giftLines: {
    love: ['...Ka pai. That’s good.', 'Hm. You know what a man needs. Thank you.'],
    like: ['Useful.', 'That’ll do.'],
    neutral: ['Mm.'],
    dislike: ['Too sweet. Sunny might.', 'Not for me, boy.'],
    hate: ['That stuff brings every rat for a mile. Bury it.'],
  },
});
book('rua', {
  intro: [
    ['rua', '...', 'serious'],
    ['rua', 'You walk loud.', 'grumpy'],
    ['mori', 'People keep telling me that. I’m Mori.', 'happy'],
    ['rua', 'Rua. These are my hills. Mine to look after. Watch where you put your feet and we’ll get on.', 'serious'],
  ],
  tiers: [
    [
      [['rua', 'Stoats came ashore with the old whalers. Rats too. They eat the eggs. The birds here never learned to run.', 'serious'], ['rua', 'So I run for them.', 'neutral']],
      [['rua', 'Sunny talks enough for both of us.', 'teasing']],
      [['rua', 'Waste nothing. Not food, not words, not days.', 'serious']],
    ],
    [
      [['rua', 'My koro walked these hills before me. Same line. Same rocks. I still find his marks on the trees.', 'thinking']],
      [['rua', 'You set a trap like a scientist. Too neat. Animals don’t trust neat.', 'teasing'], ['mori', 'How should I set it?', 'thinking'], ['rua', 'Like you forgot it there.', 'neutral']],
    ],
    [
      [['rua', 'Forty years. I’ve seen the ground birds come back on this ridge. You can hear them at night now.', 'happy'], ['rua', 'Worth every cold morning.', 'happy']],
    ],
    [
      [['rua', 'You’re all right, Mori. Don’t tell Sunny I said. She’ll be insufferable.', 'happy']],
    ],
  ],
  story: [
    { key: 'traps', when: () => done('q_traps'), c: [['rua', 'Two stoats on your line. That’s a nest of eggs that hatch this spring. Good work, boy.', 'happy']] },
  ],
});

definePerson({
  id: 'sunny', name: 'Sunny', group: 'hunter', adult: true, romanceable: true, age: 29, role: 'Trapper’s apprentice, Ngā Puke Kōhatu', color: '#b82c22', home: 'hills', where: 'The trappers’ camp, or out-shooting someone',
  blurb: 'Loud, warm and better than you at everything, which she will tell you about. Cooks like a dream.',
  loves: ['dish_fishstew', 'dish_hotpot', 'vil_kumara', 'dish_roastbulbs', 'dish_boilup'], likes: ['kind:food', 'flint', 'feather', 'stone'], dislikes: ['moss', 'tea'], hates: ['dish_charred'],
  giftLines: {
    love: ['OH. Mori. You beautiful man. Is that for me? It’s for me. I’m eating it right now.', 'That’s the good stuff! Rua, look! ...He’s pretending he’s not jealous.'],
    like: ['Choice! Cheers, bro.', 'Ha! Sweet as. Thank you!'],
    neutral: ['Uh. Thanks? I’ll find a use. Probably throw it at Rua.'],
    dislike: ['Tea? Nah. Tea is hot leaf water. Give me something with SALT in it.'],
    hate: ['Is that... charcoal? Did you set fire to dinner? Oh no, Mori. Oh no.'],
  },
});
book('sunny', {
  intro: [
    ['sunny', 'HEY! Look at this, Rua, a stranger! A real one! With a camera!', 'excited'],
    ['sunny', 'Sunny Faleolo. Best shot in the hills, best cook in the hills, and only one in the hills who smiles.', 'smug'],
    ['mori', 'Mori. Biologist. Possibly the worst shot in the hills.', 'laugh'],
    ['sunny', 'HA! I like you. Stay for a feed. Rua, he’s staying for a feed!', 'laugh'],
  ],
  tiers: [
    [
      [['sunny', 'My mum taught me to cook, my uncle taught me to shoot, and Rua taught me to shut up. Two out of three.', 'laugh']],
      [['sunny', 'Bet you can’t hit that tin from here.', 'teasing'], ['mori', 'Bet I can.', 'determined'], ['sunny', 'Bet you can’t. I’ll be here all day not being surprised.', 'smug']],
      [['sunny', 'People think trapping’s about killing. It’s about keeping. Every stoat we catch is a nest that makes it.', 'serious']],
    ],
    [
      [['sunny', 'Back home my family have a restaurant. Eight brothers and sisters and I’m the only one who left. Mum still sends recipes by radio.', 'happy']],
      [['sunny', 'You know what I miss? Dancing. Proper dancing, where your feet hurt after. Nobody dances in the hills. Rua definitely doesn’t.', 'thinking']],
    ],
    [
      [['sunny', 'You’re easy to talk to, you know that? Most people I meet, I talk AT. You I talk TO.', 'happy']],
      [['sunny', 'Okay, confession. You’re not the worst shot in the hills. Rua is. He just never misses because he never shoots.', 'laugh']],
    ],
    [
      [['sunny', 'Whatever happens, you’ve got a feed and a fire up here any time. That’s a promise. Faleolo promise. Those are serious.', 'happy']],
    ],
  ],
  sweet: [
    [['sunny', 'So. That walk. I keep humming. I don’t hum. Rua asked if I was sick.', 'teasing'], ['sunny', 'I’m not sick. Just so you know.', 'happy']],
    [['sunny', 'I made extra kai today. For no reason. Definitely not for anyone in particular.', 'smug']],
  ],
  partner: [
    [['sunny', 'There he is! My favourite worst shot in the hills.', 'happy']],
    [['sunny', 'Told Mum about you on the radio. She asked if you can cook. I said no. She said “he can learn”. You’re in, bro.', 'laugh']],
    [['sunny', 'You know what I like? You never try to win. Everyone tries to win against me. You just... come along. It’s nice.', 'happy']],
  ],
  story: [
    { key: 'cans', when: () => done('q_cans'), c: [['sunny', 'Three cans! I’m telling everyone you got lucky. Privately I’m telling myself you’re not bad.', 'smug']] },
  ],
});

// ================================================================== craftspeople
definePerson({
  id: 'tipene', name: 'Tīpene', group: 'craft', adult: true, age: 68, role: 'Master carver', color: '#7e5530', home: 'camp', where: 'Visits the camp from up the coast',
  blurb: 'Has carved meeting-house posts, waka prows and one very rude walking stick. Says the wood tells him what it wants to be.',
  loves: ['plank', 'resin', 'v10_obsidian', 'v10_pumice'], likes: ['wood', 'bone', 'flint', 'shell_opal', 'tea'], dislikes: ['scrap', 'canvas'], hates: ['dish_charred'],
  giftLines: {
    love: ['Feel that grain. Mori, this is good timber. Somebody’s going to be very happy in a hundred years.', 'Ha! You’ve been listening. This is exactly what I needed.'],
    like: ['Ka pai. I’ll find what’s hiding in it.', 'Good. Good. Thank you, e hoa.'],
    neutral: ['Mm. Maybe it wants to be something. Maybe it wants to be left alone.'],
    dislike: ['Tin. Wire. Plastic. These things don’t talk, boy. They just complain.'],
    hate: ['Burnt? You burnt it? The poor thing.'],
  },
});
book('tipene', {
  intro: [
    ['tipene', 'Kia ora. Don’t mind me. I heard there was a big old ship broken on the rocks here, and I came to see what she was made of.', 'happy'],
    ['tipene', 'Tīpene. I carve. Aroha’s koro and I are old friends. Old enemies too, at cards.', 'teasing'],
    ['mori', 'Mori. The ship was a fishing boat. The Kittiwake.', 'happy'],
    ['tipene', 'Steel and plastic, mostly. But her wheel... her wheel is teak. Somebody loved that wheel.', 'thinking'],
  ],
  tiers: [
    [
      [['tipene', 'You don’t carve a piece of wood. You take away the bits that aren’t the thing. My teacher said that. He was quoting somebody. Everybody is quoting somebody.', 'thinking']],
      [['tipene', 'Hold a chisel like a pencil, not like a spoon. You’re not eating the wood.', 'teasing']],
      [['tipene', 'Every carving tells you who it’s for and who it came from. That’s whakapapa. Even a paddle has a family.', 'serious']],
    ],
    [
      [['tipene', 'When I was a boy I carved a bird for my mother. It looked like a potato with a beak. She kept it forty years.', 'happy']],
      [['tipene', 'Your hands are good. Patient. Scientists’ hands. You’d make a carver if you stopped photographing everything long enough to hold a chisel.', 'teasing']],
    ],
    [
      [['tipene', 'I’m too old to walk this far, you know. I come anyway. The company’s good.', 'happy']],
    ],
    [
      [['tipene', 'One day I’ll carve you a pou, Mori. A post. With your camera on it, and the pug. People will ask about it for a hundred years.', 'happy']],
    ],
  ],
  story: [
    { key: 'paddle', when: () => done('q_timber'), c: [['tipene', 'Your paddle will outlast both of us. Treat her kindly and she’ll get you home.', 'happy']] },
  ],
});

definePerson({
  id: 'ngaio', name: 'Ngaio', group: 'craft', adult: true, age: 31, role: 'Weaver', color: '#226282', home: 'camp', where: 'Visits the camp, collecting rope and nets',
  blurb: 'Studied under Whaea Mere, then went her own way: harakeke and fishing net and anything the sea gives back.',
  loves: ['flaxleaf', 'flax', 'driftglass', 'rope'], likes: ['canvas', 'feather', 'kind:shell', 'kelp', 'vil_tea'], dislikes: ['scrap', 'grub'], hates: ['dish_grubfry'],
  giftLines: {
    love: ['Oh, these are lovely long leaves. You cut them low, too. Whaea Mere would be proud of you.', 'Rope! Real rope! Do you know how good this is going to look woven through a kete?'],
    like: ['Ooh, I can use this. Thank you!', 'Pretty. That’s going in somewhere. Somewhere good.'],
    neutral: ['Hm! Okay. I’ll think about it. Everything goes somewhere.'],
    dislike: ['A grub? Mori. I weave. I don’t snack.'],
    hate: ['Fried GRUBS? In my KETE? No. Absolutely not.'],
  },
});
book('ngaio', {
  intro: [
    ['ngaio', 'Is that NYLON? Blue nylon rope, on a beach, just lying there? Do you know what I could do with that?', 'excited'],
    ['ngaio', 'Sorry. Hi. Ngaio. I weave. I walk the coast collecting what the sea brings in, and the sea brought in a whole boat.', 'happy'],
    ['mori', 'Mori. Help yourself. Joshu won’t mind. Probably.', 'happy'],
    ['ngaio', 'I like you already. *humming* La la la, rope rope rope...', 'happy'],
  ],
  tiers: [
    [
      [['ngaio', 'Whaea Mere taught me. Every leaf from the outside of the bush, never the heart. The heart is the baby. You leave the baby with its parents.', 'serious']],
      [['ngaio', 'People think weaving is slow. It is slow. That’s the point. Your hands go slow and your head goes quiet.', 'happy']],
      [['ngaio', 'Your camp is so messy. I mean that lovingly. I mean that with my whole heart. It’s SO messy.', 'teasing']],
    ],
    [
      [['ngaio', 'I’m weaving a cloak with every colour of net I find on the coast. It’s going to take ten years. Maybe twenty. That’s fine.', 'happy']],
      [['ngaio', 'Mere says I hum too much when I work. I say a quiet weaver is a sad weaver.', 'teasing']],
    ],
    [
      [['ngaio', 'You notice things. Most people look at a kete and see a bag. You looked at the pattern. That means a lot, you know.', 'happy']],
    ],
    [
      [['ngaio', 'When the boat comes, I’m sending a kete with you. So you remember us. As if you could forget the messiest camp on the coast.', 'happy']],
    ],
  ],
  story: [
    { key: 'kete', when: () => done('q_nets'), c: [['ngaio', 'How’s the kete holding up? If a single strand comes loose, bring it straight back. I take it very personally.', 'teasing']] },
  ],
});

// ================================================================== the palm grove
definePerson({
  id: 'marge', name: 'Marge', group: 'naturalist', adult: true, age: 74, role: 'Retired naturalist (and castaway by choice)', color: '#7a6a2a', home: 'isle-grove', where: 'A palm-frond hut in the grove',
  blurb: 'Sailed here alone eleven years ago, lost her yacht on the reef and decided she liked it. Has drawn everything on the island twice.',
  loves: ['tea', 'vil_tea', 'plt_ghostfern', 'ratabloom', 'pitcher', 'dish_compote'], likes: ['kind:plant', 'kind:fungus', 'feather', 'eggshell', 'moonfruit'], dislikes: ['ration', 'scrap'], hates: ['bug_hornet', 'dish_charred'],
  giftLines: {
    love: ['Oh my word. Oh my WORD. Do you know how long it’s been since anyone brought me tea? Eleven years. Eleven!', 'A ghost fern! In a little jar! I could kiss you. I shan’t. But I could.'],
    like: ['How lovely. I’ll press it tonight.', 'Thank you, dear boy. That’s going straight in the sketchbook.'],
    neutral: ['Oh! Well. Everything is interesting if you look long enough. I shall look.'],
    dislike: ['Ship’s biscuit. I lived on those for a month after the wreck. I’d rather eat my hat.'],
    hate: ['A HORNET? Take it outside! Gently! But OUTSIDE!'],
  },
});
book('marge', {
  intro: [
    ['marge', 'Don’t move! Don’t... oh, it’s gone. You’ve frightened off a very rare beetle. Never mind. There’ll be another. There always is.', 'surprised'],
    ['marge', 'Dr Marguerite Holloway. Marge. Naturalist, retired. Castaway, also retired. I live here now.', 'happy'],
    ['mori', 'You LIVE here? On purpose?', 'surprised'],
    ['marge', 'I lost my yacht on the reef eleven years ago, looked around, and thought: well, this will do. It did. It does.', 'happy'],
  ],
  tiers: [
    [
      [['marge', 'Everything on this island is related to something you know and nothing you’ve seen. Isn’t that marvellous?', 'excited']],
      [['marge', 'I talk to the birds. They don’t talk back, which makes them excellent company.', 'teasing']],
      [['marge', 'Draw it, young man. Don’t just photograph it. When you draw a thing you have to look at it properly.', 'serious']],
    ],
    [
      [['marge', 'My wife used to say I loved beetles more than her. Not true. I loved her exactly as much as beetles. Which is a great deal.', 'happy'], ['marge', 'She’d have liked you.', 'sad']],
      [['marge', 'Those Helix people came by. Asked me what I knew. I told them a great many fascinating things about moss. They left.', 'smug']],
    ],
    [
      [['marge', 'When I’m gone, someone ought to have my sketchbooks. I’ve been thinking it might be you.', 'thinking'], ['mori', 'Marge...', 'sad'], ['marge', 'Not soon! Heavens. I’ve got at least four more beetles to find.', 'laugh']],
    ],
    [
      [['marge', 'You remind me of me, you know. Before I got old and wise and terribly charming.', 'happy']],
    ],
  ],
  story: [
    { key: 'pages', when: () => done('q_pages'), c: [['marge', 'My sketchbook is whole again. You can’t imagine. Eleven years of looking, all back in one place.', 'happy']] },
    { key: 'rangers', when: () => hasMet('hine'), c: [['marge', 'Hine and Doug come by on Sundays. Doug sings. I pretend to be asleep. We’re all very fond of each other.', 'teasing']] },
  ],
});
