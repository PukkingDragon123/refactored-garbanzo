// Tiny painted pixel icons for UI text: the game never shows emoji or unicode pictographs on screen,
// it paints these instead.
//
// Each icon is a small hand-placed bitmap (a few pixels across) with its own colour ramp and an
// automatic 1px ink outline, rendered once into a PixelBuffer and cached as a data URL per scale.
//
//   pxIcon('star')            -> '<img class="px-ic" ...>' HTML snippet, sized in whole pixels
//   pxIconURL('note', 2)      -> data URL (for <img src> or CSS backgrounds)
//   pxIconCss('play', 2)      -> 'url("data:...")' for CSS `content:` / `background-image:`
//   pxIconBuf('heart')        -> PixelBuffer (blit into canvas / pixel-buffer text instead of a glyph)
//   iconize(html)             -> swaps the few glyphs that hand-written dialogue uses (♪ ♥ ★ ☆ ✓ ✕ ▶ ◀ ▼)
//                                for the matching icons. Dialogue and bark data keep ♪ etc. as markup
//                                tokens; every renderer (bubbles, dialogue box, toasts) runs this.

import { PixelBuffer } from '../art/pixel';
import { hex } from '../art/color';

interface PxDef {
  /** rows of the bitmap; '.' or ' ' is transparent, any other char is looked up in `pal` */
  rows: string[];
  pal: Record<string, string>;
  /** outline colour (1px, 4-neighbour) or false for none (ink icons on light keycaps) */
  ink?: string | false;
}

const INK = '#140e12';
const GOLD = { a: '#fff6c4', b: '#ffd048', c: '#e09422', d: '#9a5810' };
const GOLD_INK = '#3e1a06';

/** the four arrow-key icons as plain ink shapes (no outline) */
function arrows(prefix: string, pal: Record<string, string>): Record<string, PxDef> {
  return {
    [prefix + 'up']: { rows: ['..k..', '.kkk.', 'kkkkk', '..k..', '..k..', '..k..'], pal, ink: false },
    [prefix + 'down']: { rows: ['..k..', '..k..', '..k..', 'kkkkk', '.kkk.', '..k..'], pal, ink: false },
    [prefix + 'left']: { rows: ['..k...', '.kk...', 'kkkkkk', '.kk...', '..k...'], pal, ink: false },
    [prefix + 'right']: { rows: ['...k..', '...kk.', 'kkkkkk', '...kk.', '...k..'], pal, ink: false },
  };
}

export const PX_ICONS: Record<string, PxDef> = {
  /** music note (Jenna humming, songs) */
  note: {
    rows: [
      '...b...',
      '...bb..',
      '...b.b.',
      '...b..b',
      '...b...',
      '.aab...',
      'abbb...',
      'bbbc...',
      '.cc....',
    ],
    pal: { a: '#d8c8ff', b: '#9a74f0', c: '#5e3cb8' },
    ink: '#1a1028',
  },
  heart: {
    rows: [
      '.bb.bb.',
      'babbbbb',
      'bbbbbbc',
      '.bbbbc.',
      '..bbc..',
      '...c...',
    ],
    pal: { a: '#ffd0d6', b: '#ec3c50', c: '#a4182e' },
    ink: '#3a0810',
  },
  star: {
    rows: [
      '...a...',
      '..abb..',
      'abbbbbc',
      '.bbbbc.',
      '..bbc..',
      '.bbccc.',
      '.c...c.',
    ],
    pal: { a: GOLD.a, b: GOLD.b, c: GOLD.c },
    ink: GOLD_INK,
  },
  /** empty star (ratings) */
  star0: {
    rows: [
      '...a...',
      '..abb..',
      'abbbbbc',
      '.bbbbc.',
      '..bbc..',
      '.bbccc.',
      '.c...c.',
    ],
    pal: { a: '#7a8a86', b: '#4e5e5a', c: '#36443f' },
    ink: '#0e1614',
  },
  check: {
    rows: [
      '......a',
      '.....ab',
      'a...ab.',
      'ba.ab..',
      '.bab...',
      '..b....',
    ],
    pal: { a: '#b4f68a', b: '#3cae3a' },
    ink: '#0c2410',
  },
  cross: {
    rows: [
      'aa..aa',
      '.aaaa.',
      '..bb..',
      '.bbbb.',
      'bc..bc',
    ],
    pal: { a: '#ff9a7a', b: '#e04430', c: '#a8281a' },
    ink: '#3a0a06',
  },
  /** right-pointing arrowhead (buttons, selected choice, "continue") */
  play: {
    rows: [
      'b...',
      'ab..',
      'abb.',
      'abbc',
      'bbc.',
      'bc..',
      'c...',
    ],
    pal: GOLD,
    ink: GOLD_INK,
  },
  back: {
    rows: [
      '...b',
      '..ab',
      '.abb',
      'abbc',
      '.bbc',
      '..bc',
      '...c',
    ],
    pal: GOLD,
    ink: GOLD_INK,
  },
  /** "more" marker under a dialogue line */
  down: {
    rows: [
      'abbbbbc',
      '.bbbcc.',
      '..bcc..',
      '...c...',
    ],
    pal: GOLD,
    ink: GOLD_INK,
  },
  /** quest marker: side quest (a teal gem) */
  side: {
    rows: [
      '..a..',
      '.aab.',
      'aabbb',
      'abbbc',
      '.bcc.',
      '..c..',
    ],
    pal: { a: '#c4fff0', b: '#3fbca6', c: '#1e7a6c' },
    ink: '#062420',
  },
  /** filled pip (difficulty, bullet) */
  pip: {
    rows: [
      '.ab.',
      'abbc',
      'bbcc',
      '.cc.',
    ],
    pal: { a: '#ffe0a0', b: '#f0a040', c: '#b8641c' },
    ink: '#3a1a06',
  },
  /** empty pip / socket (difficulty, "not yet", focus hunting) */
  pip0: {
    rows: [
      '.aa.',
      'abba',
      'abba',
      '.aa.',
    ],
    pal: { a: '#8a9690', b: '#2a3430' },
    ink: '#0a100e',
  },
  /** recording / video light */
  rec: {
    rows: [
      '.ab.',
      'abbc',
      'bbcc',
      '.cc.',
    ],
    pal: { a: '#ffb0a0', b: '#ec3a2a', c: '#a01c14' },
    ink: '#2a0604',
  },
  /** live indicator (the translator phone) */
  live: {
    rows: [
      '.ab.',
      'abbc',
      'bbcc',
      '.cc.',
    ],
    pal: { a: '#d8fff0', b: '#5ee0c0', c: '#2a9a84' },
    ink: '#06201a',
  },
  /** autofocus locked */
  focus: {
    rows: [
      '.ab.',
      'abbc',
      'bbcc',
      '.cc.',
    ],
    pal: { a: '#d4ffb0', b: '#6ad83c', c: '#2e8a22' },
    ink: '#0a2406',
  },
  /** film canister (shots left) */
  film: {
    rows: [
      '.kk.....',
      'abbbc...',
      'abbbcddd',
      'abbbcd.d',
      'abbbcddd',
      'abbbc...',
      '.kk.....',
    ],
    pal: { a: '#fff0a0', b: '#f4b830', c: '#b06a16', d: '#4a3426', k: '#9aa4ac' },
    ink: '#24140a',
  },
  /** light meter */
  sun: {
    rows: [
      '....a....',
      '.a.....a.',
      '...cbb...',
      '..cbbbb..',
      'a.bbbbd.a',
      '..bbbdd..',
      '...bdd...',
      '.a.....a.',
      '....a....',
    ],
    pal: { a: '#ffd048', b: '#ffc838', c: '#fff6c4', d: '#e89a20' },
    ink: '#4a2006',
  },
  /** stopwatch (craft time) */
  timer: {
    rows: [
      '..ccc..',
      '...c...',
      '.aaaaa.',
      'awwkwwb',
      'awwkwwb',
      'awwwkwb',
      'awwwwwb',
      '.bbbbb.',
    ],
    pal: { a: '#dce2e2', b: '#8a949c', c: '#b4bcc2', w: '#f8faf6', k: '#20242a' },
    ink: '#141a20',
  },
  /** Enter / Return key cap symbol (ink, for .key caps) */
  enter: {
    rows: [
      '......k',
      '..k...k',
      '.kk...k',
      'kkkkkkk',
      '.kk....',
      '..k....',
    ],
    pal: { k: '#2a2230' },
    ink: false,
  },
  // arrow keys: ink, for .key caps and the light minigame buttons (key_up, key_down, key_left, key_right)
  ...arrows('key_', { k: '#2a2230' }),
  /** map: centre on me */
  target: {
    rows: [
      '..aaa..',
      '.a...b.',
      'a..r..b',
      'a.rrr.b',
      'a..r..b',
      '.b...b.',
      '..bbb..',
    ],
    pal: { a: '#ffffff', b: '#b8c0c8', r: '#ec3a2a' },
    ink: INK,
  },
  /** spin the reel */
  spin: {
    rows: [
      '..aaa.b',
      '.a...bb',
      'a...bbb',
      'a......',
      'a.....c',
      '.a...c.',
      '..ccc..',
    ],
    pal: GOLD,
    ink: GOLD_INK,
  },
};

// ---------------------------------------------------------------- render + caches
const bufs = new Map<string, PixelBuffer>();
const urls = new Map<string, string>();

function render(d: PxDef): PixelBuffer {
  const pad = d.ink === false ? 0 : 1;
  const h = d.rows.length, w = Math.max(...d.rows.map(r => r.length));
  const b = new PixelBuffer(w + pad * 2, h + pad * 2);
  const on = (x: number, y: number) => {
    const ch = d.rows[y]?.[x];
    return ch !== undefined && ch !== '.' && ch !== ' ';
  };
  if (pad) {
    const ink = hex(d.ink || INK);
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
      if (on(x, y)) continue;
      if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) b.set(x + pad, y + pad, ink);
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    const c = d.pal[d.rows[y][x]];
    if (c) b.set(x + pad, y + pad, hex(c));
  }
  return b;
}

/** The painted icon as a PixelBuffer (for canvas / pixel-buffer drawing). Unknown names fall back to a pip. */
export function pxIconBuf(name: string): PixelBuffer {
  let b = bufs.get(name);
  if (!b) { b = render(PX_ICONS[name] ?? PX_ICONS.pip); bufs.set(name, b); }
  return b;
}

/** Size in pixels of an icon at a whole-number scale. */
export function pxIconSize(name: string, scale = 2): [number, number] {
  const b = pxIconBuf(name);
  return [b.w * scale, b.h * scale];
}

/** Cached data URL of an icon enlarged by a whole-number `scale` (nearest neighbour). */
export function pxIconURL(name: string, scale = 2): string {
  scale = Math.max(1, Math.round(scale));
  const k = name + '@' + scale;
  let u = urls.get(k);
  if (u === undefined) {
    try { u = pxIconBuf(name).toDataURL(scale); } catch { u = ''; }
    urls.set(k, u);
  }
  return u;
}

/** `url("data:...")` for CSS `content:` (drawn at its natural, whole-pixel size) or `background-image:`. */
export function pxIconCss(name: string, scale = 2): string {
  return `url("${pxIconURL(name, scale)}")`;
}

let styled = false;
function installCss() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  // !important: icons land inside cards and buttons whose own `img` rules (thumbnails, portraits) must not apply
  s.textContent = `img.px-ic { display: inline-block !important; vertical-align: middle; position: relative !important; top: -0.08em !important; left: auto !important; right: auto !important; bottom: auto !important;
  margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: none !important; border-radius: 0 !important;
  object-fit: fill !important; max-width: none !important; max-height: none !important; aspect-ratio: auto !important; transform: none;
  image-rendering: crisp-edges; image-rendering: pixelated; pointer-events: none; flex: none !important; }
img.px-ic + img.px-ic { margin-left: 1px !important; }`;
  document.head.appendChild(s);
}

/** `<img class="px-ic">` HTML for an icon, sized in whole pixels. `alt` defaults to empty (decorative). */
export function pxIcon(name: string, o: { scale?: number; alt?: string; cls?: string; title?: string } = {}): string {
  installCss();
  const sc = Math.max(1, Math.round(o.scale ?? 2));
  const [w, h] = pxIconSize(name, sc);
  return `<img class="px-ic${o.cls ? ' ' + o.cls : ''}" src="${pxIconURL(name, sc)}" width="${w}" height="${h}" style="width:${w}px !important;height:${h}px !important" alt="${o.alt ?? ''}"${o.title ? ` title="${o.title}"` : ''} draggable="false">`;
}

/** `n` filled then `max - n` empty icons in a row (star ratings, difficulty pips). */
export function pxRating(n: number, max: number, on = 'star', off = 'star0', scale = 2): string {
  n = Math.max(0, Math.min(max, Math.round(n)));
  let s = '';
  for (let i = 0; i < max; i++) s += pxIcon(i < n ? on : off, { scale });
  return `<span class="px-row" style="white-space:nowrap">${s}</span>`;
}

const GLYPH: Record<string, string> = {
  '♪': 'note', '♫': 'note', '♥': 'heart', '★': 'star', '☆': 'star0', '✓': 'check', '✔': 'check',
  '✕': 'cross', '✗': 'cross', '▶': 'play', '◀': 'back', '▼': 'down',
};
const GLYPH_RE = /[♪♫♥★☆✓✔✕✗▶◀▼]/;
const SWAP_RE = /(<[^>]*>)|[♪♫♥★☆✓✔✕✗▶◀▼]/g;

/** Replace the glyph tokens hand-written text uses (♪ ♥ ★ ☆ ✓ ✕ ▶ ◀ ▼) with painted icons
 *  (never inside a tag, so attribute values are left alone). */
export function iconize(html: string, scale = 2): string {
  if (!GLYPH_RE.test(html)) return html;
  return html.replace(SWAP_RE, (m, tag) => tag ?? pxIcon(GLYPH[m], { scale }));
}

const lastHtml = new WeakMap<Element, string>();
/** Set innerHTML only when it changed (for HUD readouts with icons that refresh every frame). */
export function setHtml(e: Element, html: string) {
  if (lastHtml.get(e) === html) return;
  lastHtml.set(e, html);
  e.innerHTML = html;
}
