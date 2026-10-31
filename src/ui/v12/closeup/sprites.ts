// Hand-drawn sprite maps for the close-ups: Mori's gloved hands and the little animals. Every
// character is a pixel (see the palettes below; '.' is clear). Pure data, no imports.

/** Mori's tan leather work gloves and the olive cuff of his field shirt */
export const GLOVE_PAL: Record<string, string> = {
  o: '#24140a', D: '#4a2a12', d: '#74461e', m: '#9c622c', l: '#c48a46', h: '#e4b26a', s: '#f4dca2',
  k: '#2e2a14', K: '#4a4a22', n: '#6a6c32',
};

/** a right fist, palm down, round a handle running left-right through rows 3..6 (wrist at the bottom) */
export const GRIP = [
  '.........oo...........',
  '.....oo.ohlo.oo.......',
  '....ohlmohlmohlmo.....',
  '....ohlmohlmohlmooo...',
  '....odmdodmdodmdohmo..',
  '.oo.ohlmohlmohlmohmo..',
  'ohlmohlmohlmohlmohmo..',
  'ohhlmdlmohlmohlmohmo..',
  'olhlmmdmodmdodmdodmo..',
  '.olllmmdmhmdmhmdmhmdo.',
  '..ollmmmlhlmlhlmmmddo.',
  '...olmmlllmsmmmsmmddo.',
  '....olmmlmsmmmsmmmddo.',
  '....olmmmlsmmmsmmdddo.',
  '.....odmmmmsmmsmmddo..',
  '.....okKnKKnKKnKKnko..',
  '.....okKnKKnKKnKKnko..',
  '.....okkKkkKkkKkkKko..',
  '.....okkkkkkkkkkkkko..',
  '......ooooooooooooo...',
];

/** an open right hand from above, fingers together and a little cupped (wrist at the bottom) */
export const OPEN = [
  '.........oo.oo..........',
  '.......oohloohlo........',
  '......ohllmohllmoo......',
  '......ohllmohllmohlo....',
  '......ohlmmohlmmohlmo...',
  '......ohlmmohlmmohlmo...',
  '.....oohlmmohlmmohlmoo..',
  '.....ohohlmmohlmmohlmohlo',
  '.....ohohlmmohlmmohlmohmo',
  '.....ohodlmdodlmdodlmohmo',
  '.....ohlohlmmohlmmohlmohmo',
  '.oo..ohlohlmmohlmmohlmodmo',
  'ohlo.olmodmmdodmmdodmmddo.',
  'ohlmooolmmmhmmmmhmmmmhddo.',
  '.ohlmmllllmmmmmmmmmmmmddo.',
  '..ohlmmlllllmmmmmmmmmdddo.',
  '...ohmmllllsmmmmmsmmmddo..',
  '....odmmlllsmmmmmsmmdddo..',
  '.....odmmllsmmmmmsmmddo...',
  '......odmmlmsmmmsmmmddo...',
  '.......okKnKKnKKnKKnko....',
  '.......okKnKKnKKnKKnko....',
  '.......okkKkkKkkKkkKko....',
  '.......okkkkkkkkkkkkko....',
  '........ooooooooooooo.....',
];

/** a right hand pinching (thumb and first finger together at the top left), the rest curled */
export const PINCH = [
  '..oo..............',
  '.ohho.............',
  'ohllmo.oo.........',
  'ohlmdooohlo.......',
  '.odmmdohllmoo.....',
  '..odmmolmmmohlo...',
  '..ohlmdolmdohlmoo.',
  '...ohlmmodmohlmohlo',
  '...ohlmmmhmodmdohmo',
  '...olllmmmhmmhmodmo',
  '....ollmmmmlhlmmdmo',
  '....olllmsmmmmsmddo',
  '.....olmmsmmmmsmddo',
  '.....olmmmsmmmsmddo',
  '......odmmsmmmsdddo',
  '......okKnKKnKKnko.',
  '......okKnKKnKKnko.',
  '......okkKkkKkkKko.',
  '.......ooooooooooo.',
];

/** a ground beetle from above, two leg frames */
export const BEETLE_PAL: Record<string, string> = {
  o: '#0c0a10', d: '#1c1a2c', m: '#2c3458', l: '#3e5a8a', h: '#7aa8d0', s: '#c8e4f0', a: '#3a2a1c', e: '#e8d070',
};
export const BEETLE = [
  [
    '...o.....o...',
    '....o...o....',
    '.....ooo.....',
    '....oddoo....',
    'o..oemmmeo..o',
    '.o.oommmoo.o.',
    '..ooddoddoo..',
    '..odlhdlmdo..',
    'oooldhsdlmdooo',
    '...odlhdlmo..',
    '..ooddldmdoo.',
    '.o.odldlmdo.o',
    'o..odldlmdo..o',
    '...ooddmddo..',
    '....ooddoo...',
    '...o..oo..o..',
  ],
  [
    '..o.......o..',
    '...o.....o...',
    '.....ooo.....',
    '....oddoo....',
    '...oemmmeo...',
    'oo.oommmoo.oo',
    '..ooddoddoo..',
    '..odlhdlmdo..',
    '..oldhsdlmdo..',
    'ooodlhdlmoooo',
    '..ooddldmdoo.',
    '...odldlmdo..',
    'oo.odldlmdo.oo',
    '...ooddmddo..',
    '....ooddoo...',
    '....o.oo.o...',
  ],
];

/** a little green frog from above, sitting and mid-hop */
export const FROG_PAL: Record<string, string> = {
  o: '#0c1608', d: '#24461a', m: '#3e7a26', l: '#62a83a', h: '#a6d85a', y: '#e8e070', e: '#101008', w: '#f4f4d8', b: '#7a4a20',
};
export const FROG = [
  [
    '....oo....oo....',
    '...owwo..owwo...',
    '...oweo..oeo....',
    '..ollhoooohlmo..',
    '..ohlhhlllhlmo..',
    '.oolhlhlllmmmoo.',
    'odmolhlbllblmomdo',
    'olmolllllllmmomlo',
    '.oollmlllmmmmoo.',
    '..ollmybymmmdo..',
    '.oolmmmmmmmmdoo.',
    'olmdomlmmmdmodmlo',
    'olmmoodmmmdoommlo',
    '.ooo..odddo..ooo.',
    '.......ooo.......',
  ],
  [
    '....oo....oo....',
    '...owwo..owwo...',
    '...oweo..oeo....',
    '..ollhoooohlmo..',
    '..ohlhhlllhlmo..',
    'oolhlhlllmmmoo..',
    'mdolhlbllblmomd.',
    '.ooolllllllmmoo.',
    '...ollmlllmmmo..',
    '...ollmybymmdo..',
    '..oolmmmmmmmdoo.',
    '.olmdmlmmmdmdmlo',
    'olmmoodmmmdoommlo',
    'oddo..odddo..oddo',
    '.oo....ooo....oo.',
  ],
];

/** V12: the ember toad from above (the frog's shape in its warning colours: orange, black spots, yellow tips) */
export const TOAD_PAL: Record<string, string> = {
  o: '#1a0806', d: '#5a1a10', m: '#c84a14', l: '#e8701e', h: '#f8b040', y: '#f4d040', e: '#080404', w: '#f8e8a0', b: '#2a1210',
};

/** a shore crab from above */
export const CRAB_PAL: Record<string, string> = {
  o: '#1a0806', d: '#5a1a10', m: '#9a3418', l: '#d0582a', h: '#f09050', e: '#0a0a0a', w: '#f8f0e0',
};
export const CRAB = [
  [
    '.oo.........oo.',
    'ohlo.......olho',
    'olmo.......omlo',
    '.oddo.o.o.oddo.',
    '..oo.owoweo.oo.',
    '...oooeoeooo...',
    '..olhhlllllmo..',
    'ooolhlhllmmmooo',
    '..ohlllmlmmmdo.',
    'ooolllmmmmmdooo',
    '..odlmmmmmddo..',
    '.o.oodddddoo.o.',
    'o...o.ooo.o...o',
  ],
  [
    'oo...........oo',
    'hlo.........olh',
    'mlo.........olm',
    '.oddo.o.o.oddo.',
    '..oo.owoweo.oo.',
    '...oooeoeooo...',
    '..olhhlllllmo..',
    '.oolhlhllmmmoo.',
    'o.ohlllmlmmmdoo',
    '.oolllmmmmmdo.o',
    'o.odlmmmmmddoo.',
    '...oodddddoo...',
    '..o.o.ooo.o.o..',
  ],
];

/** one serpent vertebra, front view (the fossil spine is a row of these, each a little different) */
export const VERT_PAL: Record<string, string> = {
  o: '#2a1a0e', d: '#6a5034', m: '#a48a62', l: '#cdb48a', h: '#ece0bc', c: '#3a2a18',
};
export const VERTEBRA = [
  '.....ooo.....',
  '....ohlmo....',
  '....ohldo....',
  '.oo.olmdo.oo.',
  'ohlooomdoooldo',
  'ohllhllmmmmddo',
  '.oolhlmmmmdoo.',
  '...olhcclmdo..',
  '...olcoocmdo..',
  '...olhcclmdo..',
  '..oollmmmddoo.',
  '.ohlmooooomdo.',
  '.ooo......ooo.',
];
