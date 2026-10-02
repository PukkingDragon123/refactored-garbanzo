// V10 camp conversations. Talking to Jenna, Joshu or Aroha at camp gives something fresh every day:
//
//  - a greeting that warms up as you get closer (bond tiers: new, friendly, close, family) and knows
//    the time of day
//  - their reaction to what you found yesterday and today: new species in the research log (a few
//    famous ones by name), and the region map's discoveries (villages, ruins, caves, fossils...)
//  - otherwise the day's topic: each of them has a rotation of little conversations
//  - comments on the state of Mori (the doodle on his face after a blackout, a bad night)
//  - a request, if they have one for you; thanks when you've done one
//
// The first chat of the day also raises the bond a little.

import { game } from '../game';
import type { BubbleLine } from '../../ui/bubbles';
import { rand } from '../../core/math';
import { SPECIES_BY_ID } from '../species';
import { discoveries } from './regions';
import type { Discovery, DiscoveryKind } from './regions';
import { dayState, dayNumber, dayPhase, bondTier, addBond } from './day';
import type { Crew } from './day';
import { offerable, acceptReq, pendingThanks, markThanked } from './campquests';

type L = [string, string?];
const line = (who: string, [text, expr]: L): BubbleLine => ({ who, text, expr: expr ?? 'neutral' });

// ---------------------------------------------------------------- greetings (by bond tier, morning / evening)
const GREET: Record<Crew, { m: L[][]; e: L[][] }> = {
  jenna: {
    m: [[['Oh. Hey, nature boy.', 'neutral']], [['MORI! Perfect timing. Hold this. No, the other end.', 'excited']], [['There’s my favourite castaway!', 'happy']], [['Bestie! Come here, come here, look at this!', 'excited']]],
    e: [[['You’re back. You smell like outside.', 'teasing']], [['Welcome home! Did you bring me anything? Data counts.', 'happy']], [['You made it back! I was only a LITTLE worried.', 'happy']], [['You’re home! Sit, sit. Tell me EVERYTHING.', 'excited']]],
  },
  joshu: {
    m: [[['Morning, lad.', 'neutral']], [['Morning, Doc. Sleep all right?', 'happy']], [['Mori, son. Sit a minute.', 'happy']], [['There he is. My crew.', 'happy']]],
    e: [[['You’re back. Good.', 'neutral']], [['Back in one piece. That’s the main thing.', 'happy']], [['Evening, son. Long day?', 'happy']], [['There’s my lad. Come warm your hands.', 'happy']]],
  },
  aroha: {
    m: [[['...Mōrena.', 'neutral']], [['Mōrena, Mori.', 'happy']], [['Mōrena! Sleep well?', 'happy']], [['Kia ora, e hoa. Friend.', 'happy']]],
    e: [[['You came back. The bush let you go.', 'neutral']], [['Kia ora. You’re still in one piece.', 'teasing']], [['There you are. I was watching the track.', 'happy']], [['Haere mai. Welcome home.', 'happy']]],
  },
};

// ---------------------------------------------------------------- the daily rotation
// each entry is a little conversation; [who, text, expr]
type T = [string, string, string?][];
const DAILY: Record<Crew, T[]> = {
  jenna: [
    [['jenna', 'Status report: the solar panel works, the battery works, and I have named the battery. Her name is Brenda.', 'smug'], ['mori', 'Why Brenda?', 'thinking'], ['jenna', 'She’s reliable and she doesn’t talk back. Unlike SOME people. Kevin.', 'teasing']],
    [['jenna', 'Do you think there’s wifi on Zealandia? Like, ancient wifi. Fossil wifi.', 'thinking'], ['mori', 'I think the fastest data connection here is Aroha shouting.', 'teasing'], ['jenna', 'Ha! True. Ultra-low latency.', 'laugh']],
    [['jenna', 'I rewired the string lights so they twinkle. Nobody asked. Everybody needed it.', 'happy'], ['mori', 'They’re very twinkly.', 'happy'], ['jenna', 'Thank you. I’m an artist. Of electrons.', 'smug']],
    [['jenna', 'Dad keeps saying the boat’s “nearly seaworthy”. He said that about the Kittiwake. And look where we are.', 'teasing'], ['mori', 'On a beautiful beach?', 'happy'], ['jenna', '...okay, fair point. Don’t tell him I said it was beautiful.', 'happy']],
    [['jenna', 'I miss noodles. Real noodles. With the little flavour packet.', 'sad'], ['mori', 'I miss my microscope that doesn’t have sand in it.', 'sad'], ['jenna', 'To the noodles and the microscope. May we meet again.', 'happy']],
    [['jenna', 'If you find anything shiny out there, a wire, a bolt, a mysterious alien artifact, it’s mine. Dibs.', 'excited'], ['mori', 'Even the alien artifact?', 'surprised'], ['jenna', 'ESPECIALLY the alien artifact.', 'smug']],
    [['jenna', 'Chunk stole my screwdriver again. I found it in his bed. Next to three socks and a spoon.', 'grumpy'], ['mori', 'He’s building a nest.', 'thinking'], ['jenna', 'He’s building a CRIME EMPIRE.', 'angry']],
    [['jenna', 'I’ve been thinking. If I had a drone, you could photograph birds from ABOVE. Bird butts. For science.', 'thinking'], ['mori', 'That’s actually... a really good idea.', 'surprised'], ['jenna', 'I know. I have them all the time. Mostly at 3 a.m.', 'smug']],
    [['jenna', 'Aroha taught me a word today. “Kaitiaki”. Guardian. She says it’s what we’re being here.', 'happy'], ['mori', 'Guardians of the beach.', 'happy'], ['jenna', 'Guardians of the beach! I want a badge. I’m making a badge.', 'excited']],
    [['jenna', 'Dad told me the shark story again. In this version the shark apologised.', 'teasing'], ['mori', 'Character development.', 'laugh'], ['jenna', 'For the shark or for Dad?', 'laugh']],
  ],
  joshu: [
    [['joshu', 'Ankle’s better. I can stand on it without swearing now. Mostly.', 'happy'], ['mori', 'Aroha’s poultice?', 'thinking'], ['joshu', 'Aye. Smells like a compost heap. Works like a charm.', 'happy']],
    [['joshu', 'Rule of the sea, lad: never go out without telling someone where. Same goes for the bush.', 'serious'], ['mori', 'I always tell you.', 'neutral'], ['joshu', 'You always tell Chunk. Chunk is not someone.', 'teasing']],
    [['joshu', 'Watch the sky in the morning. Red sky, shepherds warning. Grey sky... well. Probably rain.', 'thinking'], ['mori', 'Very scientific.', 'teasing'], ['joshu', 'Forty years at sea, lad. It’s right more often than the radio.', 'happy']],
    [['joshu', 'Jenna’s mother would have loved this place. She liked a beach with no people on it.', 'sad'], ['mori', 'What was she like?', 'neutral'], ['joshu', 'Stubborn. Clever. Laughed like a gull. Jenna’s her spit.', 'happy']],
    [['joshu', 'Pack light, but pack food. A hungry man makes bad decisions. I married twice.', 'teasing'], ['mori', 'Was that the food?', 'laugh'], ['joshu', 'Mostly the food.', 'laugh']],
    [['joshu', 'Saw a big fish rolling off the rocks this morning. Biggest I’ve seen here. Bring a rod sometime.', 'excited'], ['mori', 'How big?', 'surprised'], ['joshu', 'THIS big. ...It gets bigger every time I tell it, so catch it quick.', 'teasing']],
    [['joshu', 'You know what I like about you, Doc? You look at a crab and you see a whole world.', 'happy'], ['mori', 'Crabs ARE a whole world.', 'happy'], ['joshu', 'See? That. Keep that.', 'happy']],
    [['joshu', 'Knot of the day: the bowline. The rabbit comes up the hole, round the tree, and back down the hole.', 'serious'], ['mori', 'Why is the rabbit going round the tree?', 'thinking'], ['joshu', 'Nobody knows, son. Nobody knows.', 'serious']],
    [['joshu', 'Smoker’s working a treat. Smoked fish keeps for days. Take some on the trail.', 'happy']],
    [['joshu', 'I keep looking out to sea, waiting for the Kittiwake to come round the point. Daft, eh.', 'sad'], ['mori', 'Not daft.', 'neutral'], ['joshu', '...No. Not daft.', 'sad']],
  ],
  aroha: [
    [['aroha', 'You walk too loud in the bush. Heel last, not heel first. Like you’re sneaking up on breakfast.', 'serious'], ['mori', 'I’ll try.', 'neutral'], ['aroha', 'Don’t try. Just do it quietly.', 'teasing']],
    [['aroha', 'Pīwakawaka followed me all morning. Fantails. They eat the bugs you kick up.', 'happy'], ['mori', 'Like the twinfans on the beach!', 'excited'], ['aroha', 'Mm. Everything here has a cousin. Nothing here is quite the same.', 'thinking']],
    [['aroha', 'My nan says the island remembers who treats it well. I think she means the berries.', 'teasing'], ['mori', 'The berries remember?', 'surprised'], ['aroha', 'Take only what you need and they come back. That’s remembering.', 'serious']],
    [['aroha', 'Your dog dug up my kūmara.', 'grumpy'], ['mori', 'You have kūmara?', 'surprised'], ['aroha', 'HAD. I had kūmara.', 'angry']],
    [['aroha', 'When the tide goes out at night, the rock pools glow. Have you seen it?', 'happy'], ['mori', 'No! What glows?', 'excited'], ['aroha', 'Go and look. Better than me telling you.', 'teasing']],
    [['aroha', 'Jenna asked me how to say “I am a genius” in te reo. I told her. She doesn’t know what I really taught her.', 'smug'], ['mori', 'What did you teach her?', 'thinking'], ['aroha', '“I have a very small head.” Don’t tell her.', 'laugh']],
    [['aroha', 'You count animals. I count them too. We should compare notes.', 'neutral'], ['mori', 'I’d love that.', 'happy'], ['aroha', 'Mine are in my head. Yours are in a box with a battery. We’ll see whose is better.', 'teasing']],
    [['aroha', 'Kaitiaki. It means guardian. The one who looks after a place. That’s why I was angry, the first day.', 'serious'], ['mori', 'I know. I’m sorry about Chunk.', 'sad'], ['aroha', 'Chunk is a guardian too. Of snacks.', 'laugh']],
    [['aroha', 'Your photos. Can I see them sometime? Of the kororā. My koro would like that.', 'happy'], ['mori', 'Of course. Any time.', 'happy']],
    [['aroha', 'Ruru were calling all night. The owl. They say it’s a good sign when you hear it close.', 'thinking'], ['mori', 'And if it’s far away?', 'neutral'], ['aroha', 'Then it’s just an owl.', 'teasing']],
  ],
};

// ---------------------------------------------------------------- talking again the same day
const AGAIN: Record<Crew, L[]> = {
  jenna: [['Still here! Still brilliant.', 'smug'], ['Busy busy busy. Unless you have snacks.', 'happy'], ['If you see Kevin, tell him the fuse box is NOT a hotel.', 'teasing'], ['Go do science! I’ll do the other science.', 'happy']],
  joshu: [['Off you go, lad. Daylight’s burning.', 'neutral'], ['Mind the ankle-breakers on the rocks.', 'serious'], ['You’ll want water. Always more water than you think.', 'neutral'], ['Still here, Doc. Not going anywhere on this foot.', 'teasing']],
  aroha: [['Mm?', 'neutral'], ['Go on. The bush won’t explore itself.', 'teasing'], ['Watch the tide on the rocks.', 'serious'], ['Haere rā. Go well.', 'happy']],
};

// ---------------------------------------------------------------- reactions to the day's finds
const SPECIES_LINES: Record<string, Partial<Record<Crew, L>>> = {
  corvexseal: { jenna: ['The SOFA WITH TEETH is in your log now! I’m so proud of it. And of you. Mostly it.', 'excited'], joshu: ['That seal. Great lump of a thing. Don’t you go poking it again.', 'teasing'], aroha: ['Kekeno pango. Treat him with respect. He was here first.', 'serious'] },
  jewelhornet: { jenna: ['You went NEAR the hornets? On PURPOSE? Who raised you?', 'shocked'], joshu: ['Hornets. I’ll take a shark any day.', 'grumpy'], aroha: ['The jewel ones. They guard the berries. Like I guard the island.', 'serious'] },
  glasscrab: { jenna: ['A glass crab! I want one as a pet. I’d call it Windows.', 'excited'], aroha: ['The clear ones. You can see their hearts. Nice photo.', 'happy'] },
  duskwaddler: { jenna: ['THE LITTLE FURRY WADDLE BIRDS! Mori. MORI. I would die for them.', 'excited'], aroha: ['You found their burrows. Be gentle with them. They’re my favourite.', 'happy'] },
  starweb: { jenna: ['The glowing cave spiders! Creepy AND pretty. My two favourite things.', 'excited'], joshu: ['Glow bugs in a cave. Stars underground. My old man would’ve loved that.', 'happy'] },
  trycop: { joshu: ['Three claws on a crab? Never heard the like. Bet it’s good in a stew.', 'teasing'], aroha: ['That crab nips. Hard. Ask me how I know.', 'grumpy'] },
  canhermit: { jenna: ['A crab living in a CAN? From OUR boat? That’s the most Kittiwake thing ever.', 'laugh'] },
  periscope: { joshu: ['Eyes on stalks. Like a submarine. Navy should hire it.', 'teasing'] },
};
const SPECIES_GENERIC: Record<Crew, L[]> = {
  jenna: [['You documented a {name}! I don’t know what that is but I’m HAPPY about it.', 'excited'], ['New entry in the log: {name}. The laptop made a little happy noise. I programmed it to.', 'smug']],
  joshu: [['A {name}, eh? Never seen one in forty years at sea. Good work, son.', 'happy'], ['Jenna showed me your {name} photo. Sharp as a tack.', 'happy']],
  aroha: [['The {name}. You photographed it without scaring it. Ka pai.', 'happy'], ['{name}. I’ve seen those. I never knew anyone could write a whole page about one.', 'thinking']],
};
const FIND_LINES: Record<DiscoveryKind, Record<Crew, L[]>> = {
  species: { jenna: [['A whole new species: {name}! Put my name on it. Jennasaurus.', 'excited']], joshu: [['{name}. New to science, they tell me. New to me, anyway.', 'happy']], aroha: [['{name}. It has a name now. A new one.', 'thinking']] },
  plant: { jenna: [['A plant? Like, a leaf? ...Okay it’s a cool leaf.', 'teasing']], joshu: [['Can you eat it? That’s my only question about plants.', 'teasing']], aroha: [['The {name}. My nan knows it. Ask her what it’s for, someday.', 'thinking']] },
  village: { jenna: [['A VILLAGE?! People?! Do they have a charger?!', 'shocked']], joshu: [['People out there. Well, I’ll be. Tread gently, lad.', 'surprised']], aroha: [['You saw {name}? Were there... was there smoke? People?', 'surprised']] },
  ruin: { jenna: [['Ruins! Old ones! Were there buttons? Ancient buttons?', 'excited']], joshu: [['Somebody built something out there, long before us. Makes you think.', 'thinking']], aroha: [['The old places. Be respectful there. They’re tapu, some of them.', 'serious']] },
  artifact: { jenna: [['You found an ARTIFACT? Can I hold it? I won’t take it apart. Much.', 'excited']], joshu: [['Made by hands, that. Old hands.', 'thinking']], aroha: [['Taonga. A treasure. Somebody made that with care.', 'serious']] },
  cave: { jenna: [['A cave! Did anything want to eat you? Tell me something wanted to eat you.', 'excited']], joshu: [['Caves. Damp, dark and full of things with too many legs. Rather you than me.', 'grumpy']], aroha: [['{name}. My cousins used to dare each other to go in there.', 'teasing']] },
  fossil: { jenna: [['A FOSSIL. A rock that used to be alive! Rocks are so cool when they cheat.', 'excited']], joshu: [['A fossil, eh? Older than my jokes, then.', 'teasing']], aroha: [['The old ones, turned to stone. The land keeps everything, if you let it.', 'thinking']] },
  ecosystem: { jenna: [['A whole ecosystem? Like a network, but squishier.', 'thinking']], joshu: [['Everything eating everything else. Like a ship’s galley.', 'teasing']], aroha: [['Everything connected. That’s what I keep telling you.', 'serious']] },
  location: { jenna: [['New place on the map: {name}! Your map is getting so full. Proud of your map.', 'happy']], joshu: [['{name}, eh? Mark the way back. Always mark the way back.', 'serious']], aroha: [['{name}. I know it. Did you go the long way? You went the long way.', 'teasing']] },
  landmark: { jenna: [['A landmark! Did you take a selfie? Tell me you took a selfie.', 'excited']], joshu: [['A good landmark’s worth more than a compass. Remember it.', 'serious']], aroha: [['You saw {name}. Good. Now you can’t get lost. Probably.', 'teasing']] },
  sample: { jenna: [['A sample! Is it gooey? Please say gooey.', 'excited']], joshu: [['Don’t keep it near the food, lad.', 'grumpy']], aroha: [['Take only a little. Leave the rest to grow.', 'serious']] },
};
const sub = (t: string, name: string) => t.replace(/\{name\}/g, name);

/** the newest thing this crew member hasn't commented on yet (yesterday's or today's) */
function freshFind(who: Crew): { key: string; line: L } | null {
  const d = dayState();
  const seen = (d.seen[who] ??= []);
  const day = dayNumber();
  // the region map's discoveries
  const finds: Discovery[] = discoveries().filter(f => f.day >= day - 1 && !seen.includes('d:' + f.id)).sort((a, b) => b.day - a.day);
  for (const f of finds) {
    const pool = FIND_LINES[f.kind]?.[who];
    if (pool?.length) return { key: 'd:' + f.id, line: rand.pick(pool).map((x, i) => (i === 0 ? sub(x as string, f.name) : x)) as L };
  }
  // species newly in the research log
  const fresh = Object.entries(game.save.research).filter(([id, e]) => e.day >= day - 1 && !seen.includes('s:' + id)).sort((a, b) => b[1].n - a[1].n);
  for (const [id] of fresh) {
    const sp = SPECIES_BY_ID[id];
    if (!sp) continue;
    const special = SPECIES_LINES[id]?.[who];
    const l: L = special ?? (rand.pick(SPECIES_GENERIC[who]).map((x, i) => (i === 0 ? sub(x as string, sp.name) : x)) as L);
    return { key: 's:' + id, line: l };
  }
  return null;
}

/** after a blackout Jenna draws on his face; everybody has an opinion */
const DOODLE: Record<Crew, L[]> = {
  jenna: [['I don’t know what you’re talking about. Your face has always looked like that.', 'smug'], ['The moustache suits you. Very distinguished. Very... permanent marker.', 'teasing']],
  joshu: [['Nice moustache, lad. Very... nautical.', 'teasing'], ['I’d wash that off before the agency calls. Or don’t. Your career.', 'laugh']],
  aroha: [['You have... something. On your face. I’m not going to tell you what.', 'teasing'], ['I carried you home and she drew on you. Teamwork.', 'laugh']],
};

/** what they say they're doing when you ask */
function doingLine(who: Crew, doing: string): L {
  if (!doing) return ['Oh, this and that.', 'neutral'];
  const extra: Partial<Record<Crew, L>> = {
    jenna: [`I’m ${doing}. Which is a fancy way of saying I’m a genius at work.`, 'smug'],
    joshu: [`Just ${doing}, lad. Keeps the hands busy and the mind quiet.`, 'neutral'],
    aroha: [`${doing[0].toUpperCase() + doing.slice(1)}. You could help, you know.`, 'teasing'],
  };
  return extra[who] ?? ['Busy.', 'neutral'];
}

export interface TalkHost {
  say(lines: BubbleLine[]): Promise<number>;
  doing(who: Crew): string;
  /** Mori has the doodle on his face */
  doodled(): boolean;
}

/** a full conversation with a crew member at camp */
export async function talkTo(who: Crew, h: TalkHost): Promise<void> {
  const d = dayState(), day = dayNumber();
  const first = d.talked[who] !== day;
  const phase = dayPhase();
  const evening = phase === 'evening' || phase === 'night';
  const tier = bondTier(who);
  const lines: BubbleLine[] = [];
  // thanks for a finished request
  const th = pendingThanks(who)[0];
  if (th) {
    markThanked(th);
    lines.push({ who, text: th.thanks, expr: 'happy' });
    await h.say(lines);
    return;
  }
  if (first) {
    lines.push(line(who, rand.pick(GREET[who][evening ? 'e' : 'm'][tier])));
    if (h.doodled()) lines.push(line(who, rand.pick(DOODLE[who])));
    const f = freshFind(who);
    if (f) {
      (d.seen[who] ??= []).push(f.key);
      lines.push(line(who, f.line));
    } else {
      const k = d.talks[who] ?? 0;
      const conv = DAILY[who][k % DAILY[who].length];
      d.talks[who] = k + 1;
      for (const [w, t, e] of conv) lines.push({ who: w, text: t, expr: e ?? 'neutral' });
    }
    d.talked[who] = day;
    addBond(who, 3);
  } else {
    if (h.doodled() && rand.chance(0.4)) lines.push(line(who, rand.pick(DOODLE[who])));
    else if (rand.chance(0.5)) lines.push(line(who, doingLine(who, h.doing(who))));
    else lines.push(line(who, rand.pick(AGAIN[who])));
  }
  game.persist();
  // a request, if they have one (asked once a day at most)
  const req = offerable(who)[0];
  const askedKey = 'asked:' + who;
  const asked = (d.events[askedKey] ?? 0) === day;
  if (req && !asked) {
    d.events[askedKey] = day;
    lines.push({ who, text: req.ask, expr: 'happy', choices: ['I’m on it.', 'Maybe later.'] });
    const c = await h.say(lines);
    if (c === 0) {
      acceptReq(req.id);
      const yes: Record<Crew, string[]> = { jenna: ['You’re the best!', 'YES. My hero.'], joshu: ['Good lad.', 'Knew I could count on you.'], aroha: ['Ka pai.', 'Thank you, Mori.'] };
      await h.say([{ who, text: rand.pick(yes[who]), expr: 'happy' }]);
    } else await h.say([{ who, text: who === 'jenna' ? 'Fiiine. It’s on the board if you change your mind.' : 'It’s on the board, if you change your mind.', expr: 'neutral' }]);
    return;
  }
  await h.say(lines);
}
