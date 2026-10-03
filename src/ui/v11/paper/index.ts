// =====================================================================================================
// V11 PHYSICAL UI KIT ("paper")
// =====================================================================================================
// Real objects instead of floating windows: aged paper, pencil sketches, handwriting, rubber stamps,
// tape and pins, books whose pages actually turn, and transitions that bleed ink across the screen.
// Built for the field journal (quests), the Zealandia Encyclopedia, the camp's cork board and the
// HUD's note scraps; the blueprints / crafting papers are meant to be built from the same pieces.
//
// Import from 'src/ui/v11/paper' (this file). Call installPaper() once before using the HTML helpers
// (openBook does it for you). Everything is generated at runtime; nothing here needs an asset file.
//
// ---------------------------------------------------------------- TYPE
//   CSS classes   .pp-hand  handwriting (Caveat, Google Fonts) for notes, captions, body text
//                 .pp-pix   the game's pixel font (Jersey 15) for headings and labels
//                 .pp-head  the chunky pixel display font (Jersey 10) for titles and stamps
//                 .pp-type  a typed / telex look (Pixelify Sans)
//   CSS vars      --pp-ink --pp-pencil --pp-red --pp-blue --pp-green (ink colours)
//                 --pp-hand --pp-pix --pp-head --pp-type (font stacks)
//   handReady()   resolves when the handwriting font has loaded (measure text after it)
//   NOTE the global skin forces `font-size-adjust` on every #ui element; the classes above set the
//   right value per font, so always put handwriting under .pp-hand.
//
// ---------------------------------------------------------------- PAPER (textures.ts)
//   paperTex(kind)             CSS image value of a seamless tile: 'journal' | 'parchment' | 'kraft' |
//                              'card' | 'telex' | 'flax' | 'graph' | 'blueprint' | 'cork' | 'endpaper' | 'linen'
//                              e.g. el.style.background = `${paperTex('blueprint')} 0 0 / 256px`
//   paperBg(kind, seed, age)   full CSS `background` for aged paper: tile + a non-tiling age overlay
//                              age: { stains, foxing 0..1, folds 0..2, edge 0..1 (toasted), tint }
//   ageOverlay(seed, age)      just the overlay (stretch it: `center / 100% 100%`)
//   coverTex('leather'|'cloth', '#hex')   book-cover material tiles
//   edgeClip(seed, { top, right, bottom, left: 'straight'|'deckle'|'torn'|'perforated', amp })
//                              a clip-path polygon (in %) for ragged paper edges
//   paperTileCanvas(kind)      the tile as a canvas (for canvas patterns)
//
// ---------------------------------------------------------------- INK & PENCIL (ink.ts)
//   Rough path data (deterministic per seed, in your own viewBox units):
//     roughLine(x1,y1,x2,y2,o)  roughRect(x,y,w,h,o)  roughEllipse(cx,cy,rx,ry,o)  roughCurve(pts,o)
//     roughArrow(x1,y1,x2,y2,bend,o) -> [shaft, head]  underline(w)  tick(size)  cross(size)
//     scribble(w,h)  strike(w)  tally(n,h) -> { d, w }
//     o = { rough, bow, seed, double }
//   svgInk(vw, vh, strokes, { w, h, cls, stretch })  -> '<svg>' string
//     stroke = { d, c (colour), w (width), fill, tex: 'pencil'|'ink', draw: seconds (draws itself on), delay }
//   INK, INK_BLUE, INK_RED, INK_GREEN, PENCIL colour constants
//
// ---------------------------------------------------------------- SKETCHES (sketch.ts)
//   sketchURL(src, o): Promise<dataURL>   a sprite or photo redrawn as a field sketch (cached)
//   sketchImg(src, o, cls, style)          '<img>' html that fills itself in (call fillSketches(root)
//                                          after inserting it; the book does that for its pages)
//   sketchCanvas(img|canvas, o)            the same, synchronous, for an already-loaded image
//     o = { style: 'pencil'|'ink'|'blueprint'|'chalk', size (px), wash 0..1, hatch 0..1,
//           crop: [x0,y0,x1,y1] (0..1), photo: true (find edges in colours, no alpha) }
//     'blueprint' gives white technical lines for blueprint paper (item icons -> drawings).
//   doodle(name, { size, color, pencil, draw })   margin doodles as inline SVG: boat tent palm fish
//                              crab camera sun wave pug footprints pin star mountain fire bird shell
//                              leaf compass feather magnifier (doodleNames() lists them)
//
// ---------------------------------------------------------------- THINGS ON PAPER (decor.ts)
//   tape({ w, rot, color, style })   pin({ color, style })   clip({ rot, style })
//   stamp(text, { color: 'red'|'blue'|'green'|'black', shape: 'box'|'round', small, fresh, rot })
//                              fresh = plays the stamp-down animation (pair with paperSfx('stamp'))
//   polaroid(imgURL, caption, { w, rot, tape, pin, bg })   sticky(html, { color, w, rot })
//   scrap(html, { kind, w, rot, edges })   a torn bit of any paper
//   checkbox('todo'|'done'|'now'|'fail', seed, fresh)   an ink box, ticked / crossed
//   struck(html, seed, fresh)  text crossed out with a pen stroke
//   marked(html, { mode: 'under'|'circle'|'box', color, draw })  underline / circle a word
//   tallyMarks(n, of)  luggageTag(html)  tilt(seed, max) -> '1.3deg'  escHtml(s)
//
// ---------------------------------------------------------------- BOOKS (book.ts)
//   const b = openBook({
//     id: 'ency', key: 'KeyG',                         // the key that also closes it
//     look: { title, sub, color, material, foil, band, emblem, label, inside, paper, corners },
//     sections: [{ id, tab, head: { l, r }, blocks: () => BookBlock[] | pages: () => string[],
//                  startLeft, cls, paper, shown(pageEl, i, book) }],
//     tabs: [{ id, label, color, icon, section }],    // thumb-index tabs on the fore-edge
//     ribbons: [{ section, color, label }],            // bookmark ribbons
//     start: 'section-id', onAct(act, el, book, ev), onKey(e, book), blank(seed), onClose() })
//   BookBlock = { html, cls, brk (new page first), keep (keep with next), split (may break at sentences) }
//   Content flows over as many pages as it needs (measured with the real fonts). In page html, any
//   element with data-act="..." is a control: 'goto' (+ data-k = section id), 'next', 'prev', 'close',
//   or anything you handle in onAct. Elements with class .ppb-noturn never start a page turn.
//   Handle: goto(id, { page, instant })  next()  prev()  refresh(id?)  setSections(...)  close()
//           current()  visiblePages()  closed (Promise)  isOpen()
//   Turning: drag a corner or edge (the page curls and follows), click the outer edge, the arrows,
//   arrow keys / A D / PageUp PageDown, swipe on touch, digits 1-9 jump to tabs, Esc closes.
//   While a book is open the world is frozen (game.covered) and gameplay input is blocked.
//   bookOpen() is true while any book is open.
//
// ---------------------------------------------------------------- TRANSITIONS (transition.ts)
//   game.go(...) now covers the screen with a creative transition instead of the dissolve:
//   setNextTransition('ink' | 'page' | 'iris' | 'dissolve', { title, sub, focus })  (next go only)
//   setDefaultTransition(style)   setTransitionFocus(() => [x, y] | null)  (where Mori is, 0..1)
//   'page' shows `title` handwritten on the journal page that sweeps across.
//
// ---------------------------------------------------------------- SOUND (sound.ts)
//   paperSfx('flip' | 'riffle' | 'open' | 'close' | 'pencil' | 'stamp' | 'pin' | 'tape' | 'slide' | 'ink' | 'tick', vol?)
//   (synthesized in src/core/audio.ts: pageFlip, pageRiffle, bookOpen, bookClose, pencil, stamp,
//    pinPush, tapeRip, paperSlide, inkBleed)
// =====================================================================================================

export { installPaper, handReady, PAPER_CSS } from './css';
export { paperTex, paperBg, ageOverlay, coverTex, edgeClip, paperTileCanvas, paperTileURL } from './textures';
export type { PaperKind, AgeOpts, EdgeKind, EdgeOpts } from './textures';
export {
  roughLine, roughRect, roughEllipse, roughCurve, roughArrow, underline, tick, cross, scribble, strike, tally, svgInk, ensureDefs,
  INK, INK_BLUE, INK_RED, INK_GREEN, PENCIL,
} from './ink';
export type { RoughOpts, Stroke } from './ink';
export { sketchURL, sketchImg, sketchCanvas, sketchReady, fillSketches, doodle, doodleNames, DOODLES } from './sketch';
export type { SketchOpts, SketchStyle } from './sketch';
export { tape, pin, clip, stamp, polaroid, sticky, scrap, checkbox, struck, marked, tallyMarks, luggageTag, tilt, escHtml } from './decor';
export type { CheckState } from './decor';
export { openBook, bookOpen } from './book';
export type { BookOpts, BookSection, BookBlock, BookTab, BookRibbon, BookLook, BookHandle } from './book';
export { setNextTransition, setDefaultTransition, setTransitionFocus, beginTransition, transitionFrame, transitionState } from './transition';
export type { TransitionStyle, TransitionOpts } from './transition';
export { paperSfx } from './sound';
export type { PaperSound } from './sound';
export { rng, hashStr, fbm, vnoise } from './rng';
