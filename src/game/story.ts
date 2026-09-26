// Chapters, objectives and crew dialogue.

import type { Line } from '../ui/ui';
import { game } from './game';
import { SPECIES, SPECIES_BY_ID, ALL_FACTS, SiteId } from './species';

export const SITE_NAMES: Record<SiteId, string> = {
  fernwood: 'Fernwood Floor', canopy: 'Emerald Canopy', falls: 'Thunder Falls', mangrove: 'Blackwater Mangroves', coast: 'Serpent Coast',
};

export const CHAPTER_NAMES = ['Arrival', 'First Contact', 'Up in the Trees', 'Thunder Falls', 'The Titan', 'The Deep', 'The Field Guide'];

export const seenCount = () => Object.keys(game.save.seen).length;
export const factCount = () => Object.keys(game.save.facts).length;
export const flag = (f: string) => !!game.save.flags[f];
export const setFlag = (f: string, v = true) => { game.save.flags[f] = v; };

export function unlockSite(s: SiteId) {
  if (!game.save.sites.includes(s)) {
    game.save.sites.push(s);
    game.ui.toast(`New site on the map: <b>${SITE_NAMES[s]}</b>`, 'MAP', 'teal', 4200);
  }
}

export function objective(): { t: string; text: string } {
  const s = game.save;
  switch (s.chapter) {
    case 0: return { t: 'Arrival', text: 'Talk to Dr. Vance at the field lab.' };
    case 1: return seenCount() >= 3
      ? { t: 'First Contact', text: 'Report back to Dr. Vance.' }
      : { t: 'First Contact', text: `Photograph 3 different species in Fernwood (${seenCount()}/3). Bolt’s jeep is by the gate.` };
    case 2: return factCount() >= 3 && s.seen.skyribbon
      ? { t: 'Up in the Trees', text: 'Report back to Dr. Vance.' }
      : { t: 'Up in the Trees', text: `Photograph a Skyribbon in the Emerald Canopy${s.seen.skyribbon ? ' ✓' : ''} and solve 3 facts in the Field Guide (${Math.min(3, factCount())}/3).` };
    case 3: return s.clues['giant-skin']
      ? { t: 'Thunder Falls', text: 'Show Dr. Vance what you found.' }
      : { t: 'Thunder Falls', text: 'Explore Thunder Falls. Something big has been through there.' };
    case 4: return s.seen.titan
      ? { t: 'The Titan', text: 'Get back to camp and tell Dr. Vance!' }
      : { t: 'The Titan', text: 'Track the owner of the colossal skin into the Blackwater Mangroves. Stay hidden.' };
    case 5: return s.seen.leviathan
      ? { t: 'The Deep', text: 'Tell the crew what you saw.' }
      : { t: 'The Deep', text: 'Dive at the Serpent Coast and photograph the Finned Leviathan.' };
    default: {
      const total = ALL_FACTS.length;
      return { t: 'Field Guide', text: `Complete the Zealandia Field Guide: ${factCount()}/${total} facts, ${seenCount()}/${SPECIES.length} species.` };
    }
  }
}

const L = (who: string, text: string, expr?: Line['expr']): Line => ({ who, text, expr });

/** Dialogue for Dr. Vance, which also advances the main story. Returns an optional follow-up event. */
export function vanceTalk(): { lines: Line[]; after?: () => string | void } {
  const s = game.save;
  switch (s.chapter) {
    case 0:
      return {
        lines: [
          L('imogen', 'Finch. Good, you’re up. Do you understand what happened yesterday?'),
          L('otis', 'The storm blew us four hundred kilometres off course and we found... a continent?', 'wow'),
          L('imogen', 'A *sunken* continent that isn’t sunken. Zealandia. Warm currents, no ice, and an ecosystem isolated for eighty million years.'),
          L('imogen', 'And, Finch — the dominant animals here are *snakes*. Snakes with legs. Snakes that glide. It’s magnificent.', 'happy'),
          L('otis', 'That’s... one word for it.', 'worried'),
          L('imogen', 'You’re our photographer. Take the jeep to the *Fernwood Floor* and photograph three different species. Good photos, Finch. Evidence.'),
          L('imogen', 'Every photo of an animal *doing something* is a clue. Bring them to my desk and we’ll piece together how this place works.'),
          L('imogen', 'Pip has your camera kit. Bolt will drive. And Finch? Don’t get eaten.'),
        ],
        after: () => { s.chapter = 1; },
      };
    case 1:
      if (seenCount() >= 3) return {
        lines: [
          L('imogen', 'Three species on the first outing. The legs on that Strider... do you realise what we’re looking at?', 'happy'),
          L('imogen', 'Birds never took over here. Serpents did. Everything else had to adapt around them.'),
          L('imogen', 'Next: the *Emerald Canopy*. Locals — well, Sid — swear snakes fly between the treetops. Photograph a Skyribbon.'),
          L('imogen', 'And use the Field Guide at my desk. When you have enough evidence for a fact, *deduce it*. Science, Finch.'),
        ],
        after: () => { s.chapter = 2; unlockSite('canopy'); },
      };
      return { lines: [L('imogen', 'Three species from the Fernwood Floor. Hide in the ferns, use a lure if you must. Patience makes the photo.')] };
    case 2:
      if (factCount() >= 3 && s.seen.skyribbon) return {
        lines: [
          L('imogen', 'A gliding serpent. Documented. Photographed. I may cry.', 'wow'),
          L('imogen', 'Bolt found a route to a waterfall to the north — *Thunder Falls*. Cliff nesters, divers... and he says the rocks smell of snake.'),
          L('imogen', 'Go and see. Carefully.'),
        ],
        after: () => { s.chapter = 3; unlockSite('falls'); },
      };
      return { lines: [L('imogen', 'Skyribbons are canopy gliders — watch the gaps between the big trees. And solve some facts at my desk, please. Three at least.')] };
    case 3:
      if (s.clues['giant-skin']) return {
        lines: [
          L('otis', 'Doctor... I found a shed skin at the falls. It was the size of a bus.', 'wow'),
          L('imogen', '...Show me the photos.', 'wow'),
          L('imogen', 'The scale spacing... fifteen metres. At least. And it was heading south. Toward the *Blackwater Mangroves*.', 'worried'),
          L('imogen', 'I need to know what made this. But if it notices you, you *hide*. Promise me.'),
          L('pip', 'I, uh, made you something! It’s a headlamp. For the dark. Where giant snakes are.', 'happy'),
        ],
        after: () => { s.chapter = 4; unlockSite('mangrove'); if (!s.tools.includes('headlamp')) s.tools.push('headlamp'); game.ui.toast('Received: <b>Headlamp</b> — night expeditions unlocked', 'GEAR', 'teal', 4200); },
      };
      return { lines: [L('imogen', 'Thunder Falls. Keep your eyes on the rocks as well as the birds.')] };
    case 4:
      if (s.seen.titan) return {
        lines: [
          L('otis', 'It was real. Sixteen metres of snake. It swallowed a crocodile, Doctor. A *crocodile*.', 'wow'),
          L('imogen', 'Gigantophis rex. The apex of the whole island.', 'wow'),
          L('captain', 'Aye, and it’s not the biggest thing here. My sonar’s been pinging something off the coast. Something with a fin.'),
          L('pip', 'Dive gear! I modified the old survey suit. It probably won’t leak.', 'happy'),
          L('imogen', 'The *Serpent Coast*, then. Finch... be brilliant.'),
        ],
        after: () => { s.chapter = 5; unlockSite('coast'); s.flags.divegear = true; game.ui.toast('Received: <b>Dive gear</b>', 'GEAR', 'teal', 4200); },
      };
      return { lines: [L('imogen', 'Mangroves. Stay low, stay hidden, and if the water moves by itself, run.', 'worried')] };
    case 5:
      if (s.seen.leviathan) return {
        lines: [
          L('imogen', 'Gill fronds. Feathered, crimson gill fronds on a twenty-five metre serpent. You beautiful, beautiful idiot.', 'happy'),
          L('imogen', 'We’ve barely started. Every species here tells a story about the others. Fill that Field Guide, Finch.'),
        ],
        after: () => { s.chapter = 6; },
      };
      return { lines: [L('imogen', 'The Leviathan surfaces near the reef. Get in the water with it. Carefully.')] };
    default: {
      const left = ALL_FACTS.length - factCount();
      return { lines: [L('imogen', left > 0 ? `${left} facts still unexplained in the Field Guide. The island is a puzzle, Finch, and you’re holding the pieces.` : 'Every fact. Every species. Zealandia, documented. I’m putting your name first on the paper.', left > 0 ? 'neutral' : 'happy')] };
    }
  }
}

export function sidRumor(): Line[] {
  const s = game.save;
  const unseen = SPECIES.filter(sp => !s.seen[sp.id] && sp.sites.some(site => s.sites.includes(site)));
  if (!unseen.length) return [L('sid', 'Radio’s quiet. Either we’ve seen everything, or it’s all hiding from us. I know which one I believe.')];
  const sp = unseen[Math.floor(Math.random() * unseen.length)];
  const when = sp.times.length >= 4 ? 'any time of day' : sp.times.map(t => (t === 'dusk' ? 'golden hour' : t === 'day' ? 'midday' : t)).join(' or ');
  const where = sp.sites.filter(x => s.sites.includes(x)).map(x => SITE_NAMES[x]).join(' / ');
  const lines = [
    L('sid', `Okay, don’t laugh. I’ve been picking up weird chatter. Something called a *${sp.name}*.`),
    L('sid', `Try the *${where}*, ${when}. ${sp.danger >= 2 ? 'And, uh, bring a spare pair of pants.' : 'Probably harmless. Probably.'}`),
  ];
  return lines;
}

export const LOU_MEALS = [
  { id: 'tea', name: 'Kawakawa Leaf Tea', desc: 'Steady hands: camera sway reduced', line: 'Kawakawa tea. Calms the nerves, steadies the hands. Drink up, sugar.' },
  { id: 'stew', name: 'Big Pot Stew', desc: '+4 film for the next expedition', line: 'Stew. What’s in it? Love. And a vegetable I found. Probably a vegetable.' },
  { id: 'jerky', name: 'Smoked Jerky', desc: 'Move faster while crouched', line: 'Jerky for the road. Chew slow, walk quiet.' },
];

export function speciesName(id: string | null) {
  return id ? SPECIES_BY_ID[id]?.name ?? id : 'Unknown';
}
