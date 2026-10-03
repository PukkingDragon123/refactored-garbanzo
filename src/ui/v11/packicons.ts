// V11: the little painted glyphs the Backpack and the cooking close-up use (registered into the shared
// pixel icon set, src/ui/pxicons.ts, under v11* names so nothing else is touched).

import { PX_ICONS, pxIcon } from '../pxicons';

const W = '#fff6dc', K = '#3a2614';
const add = (name: string, rows: string[], pal: Record<string, string>, ink?: string | false) => {
  if (!PX_ICONS[name]) PX_ICONS[name] = { rows, pal, ink };
};

/** register the icons (idempotent) */
export function packIcons() {
  // fork and spoon
  add('v11eat', [
    'a.a.a..bb.',
    'a.a.a.bbbb',
    'a.a.a.bbbb',
    'aaaaa.bbbb',
    '.aaa...bb.',
    '..a....b..',
    '..a....b..',
    '..a....b..',
    '..a....b..',
  ], { a: '#e8e4dc', b: '#d4cfc4' });
  // a hand, palm out
  add('v11hand', [
    '..a.a.a...',
    '..a.a.a.a.',
    '..a.a.a.a.',
    'a.aaaaaaa.',
    'aaaaaaaaa.',
    '.aaaaaaaa.',
    '..aaaaaa..',
    '..aaaaaa..',
  ], { a: '#f2c08a' });
  // drop: an arrow down onto the ground
  add('v11drop', [
    '...aa...',
    '...aa...',
    '...aa...',
    '.aaaaaa.',
    '..aaaa..',
    '...aa...',
    '........',
    'bbbbbbbb',
  ], { a: '#ffd04a', b: '#b8945a' });
  // a magnifying glass
  add('v11lens', [
    '.aaaa....',
    'abbbba...',
    'abccba...',
    'abbbba...',
    '.aaaa....',
    '....dd...',
    '.....dd..',
    '......dd.',
  ], { a: '#d29c1c', b: '#9ad8ff', c: '#e8f8ff', d: '#6a3e1c' });
  // rotate
  add('v11rot', [
    '..aaaa..',
    '.a....a.',
    'a......a',
    'a......a',
    'a....aaa',
    '.a....aa',
    '..aaa..a',
  ], { a: W });
  // repack: a little bag with shake marks
  add('v11shake', [
    'a...bb...a',
    '.a.bccb.a.',
    '..bccccb..',
    'a.bcccc b.',
    '.abccccba.',
    '..bbbbbb..',
  ].map(r => r.replace(' ', 'c')), { a: W, b: '#3a4a1e', c: '#6d7040' });
  // close (a buckle and an x)
  add('v11x', [
    'a.....a',
    '.a...a.',
    '..a.a..',
    '...a...',
    '..a.a..',
    '.a...a.',
    'a.....a',
  ], { a: W });
  // energy
  add('v11bolt', [
    '...aa',
    '..aa.',
    '.aaaa',
    'aaaa.',
    '..aa.',
    '.aa..',
    'aa...',
  ], { a: '#ffd04a' });
  // skull (poison)
  add('v11skull', [
    '.aaaa.',
    'aaaaaa',
    'a.aa.a',
    'aaaaaa',
    '.a.a..',
  ].map(r => r.length < 6 ? r + '.' : r), { a: '#f4f0e4' });
  // question mark
  add('v11q', [
    '.aaa.',
    'a...a',
    '...a.',
    '..a..',
    '.....',
    '..a..',
  ], { a: '#ffd04a' });
  // a kilo weight
  add('v11kg', [
    '..aa..',
    '.a..a.',
    '.bbbb.',
    'bbbbbb',
    'bbbbbb',
    'bbbbbb',
  ], { a: '#8a8a80', b: '#5a5a54' });
  // cooking pot
  add('v11pot', [
    '..aaaa..',
    'b.aaaa.b',
    'bccccccb',
    '.cccccc.',
    '.cccccc.',
    '..cccc..',
  ], { a: '#9a9a90', b: '#5a5a54', c: '#3a3a36' });
  // recipe book
  add('v11book', [
    'aaaaaaa.',
    'abbbbba.',
    'abccbba.',
    'abbbbba.',
    'abccbba.',
    'abbbbba.',
    'aaaaaaaa',
  ], { a: '#6a3e1c', b: '#e8d8b0', c: '#8a6a44' });
  // a log of firewood
  add('v11wood', [
    '..aaaaab',
    '.aaaaabcb',
    'aaaaaabbb',
    '.aaaaabcb',
    '..aaaaab.',
  ].map(r => r.padEnd(9, '.')), { a: '#7a4c24', b: '#c8a070', c: '#8a6038' });
  // fan (a flax fan)
  add('v11fan', [
    'a.a.a.a',
    '.aaaaa.',
    '..aaa..',
    '...b...',
    '...b...',
  ], { a: '#8db34a', b: '#6a3e1c' });
  // a knife (chop)
  add('v11knife', [
    '......aa',
    '.....aaa',
    '....aaa.',
    '...aaa..',
    '..bba...',
    '.bb.....',
    'bb......',
  ], { a: '#d8dce0', b: '#6a3e1c' });
  // stir (a spoon in a swirl)
  add('v11stir', [
    '..aaa...',
    '.a...a..',
    'a..b..a.',
    'a..b..a.',
    '.a.b.a..',
    '...b....',
  ], { a: W, b: '#a87444' });
  // a speech dot for tips
  add('v11tip', [
    '.aaaa.',
    'aaaaaa',
    'aaaaaa',
    '.aaaa.',
    '.a....',
  ], { a: W });
  // flame
  add('v11fire', [
    '...a...',
    '..aa...',
    '..aba..',
    '.abbba.',
    '.abcba.',
    'abbcbba',
    '.abbba.',
  ], { a: '#e8502a', b: '#ffa030', c: '#fff0a0' });
  void K;
}
packIcons();

export const ic = (name: string, scale = 1) => pxIcon(name, { scale });
