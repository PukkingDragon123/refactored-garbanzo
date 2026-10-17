// =====================================================================================================
// V11 PHYSICAL UI KIT ("paper"), ALL PIXEL ART
// =====================================================================================================
// Real objects instead of floating windows: aged paper, pencil sketches, handwriting, rubber stamps,
// tape and pins, books whose pages actually turn, and transitions that bleed ink across the screen.
// Every piece is pixel art: one art pixel is PX (2) CSS px, images and canvases are pixelated, lines
// are Bresenham pixel lines, gradients and shadows are dithered or quantised, nothing is rotated or
// blurred, and the handwriting is a pixel font drawn in code.
//
// Import from 'src/ui/v11/paper' (this file). Call installPaper() once before using the HTML helpers
// (openBook does it for you). Everything is generated at runtime; nothing here needs an asset file.
//
// ---------------------------------------------------------------- TYPE
//   CSS classes   .pp-hand  Mori's pixel handwriting ('PZ Hand', built in code: pxfont.ts) for notes,
//                           captions, body text. Crisp at 20px (also 10 / 30 / 40px); bold is a real
//                           second weight (font-weight 700)
//                 .pp-pix   the game's pixel font (Jersey 15) for headings and labels
//                 .pp-head  the chunky pixel display font (Jersey 10) for titles
//                 .pp-type  a typed / telex look (Pixelify Sans)
//                 .pp-label Silkscreen caps (crisp at 16px)
//                 .pp-x-hand .pp-x-j10 .pp-x-j10x2 .pp-x-j15 .pp-x-silk   exact crisp sizes
//   CSS vars      --pp-ink --pp-pencil --pp-red --pp-blue --pp-green (ink colours)
//                 --pp-hand --pp-pix --pp-head --pp-type --pp-label (font stacks)
//                 --pp-fs-hand (20px) --pp-fs-j10 (18.67px) --pp-fs-j10x2 --pp-fs-j15 (27px) --pp-fs-silk (16px)
//   handReady()   resolves when the fonts can be measured (the book lays pages out after it)
//   drawText(art, text, x, y, colour, { face: 'hand' | 'block', scale, bold })   bitmap text in canvases
//   textWidth(text, o)  wrapText(text, maxW, o)   installPixelFonts()   HAND_FAMILY
//   NOTE the global skin forces `font-size-adjust` on every #ui element; .pp-hand turns it off.
//
// ---------------------------------------------------------------- PIXELS (px.ts)
//   PX                         CSS px per art pixel (2)
//   Art                        a paint buffer: px, rect, drect (dithered), line (Bresenham), poly,
//                              ellipse, ring, blit, outline, shadow, canvas(), url(scale)
//   pxCanvas(key, paint, o)    an HTML <canvas> that paints itself at its real size once it's in the
//                              page: paint(art, w, h, t) in art px (t 0..1 when o.anim seconds is set)
//   spriteURL(key, w, h, paint)  a fixed sprite as a pre-scaled PNG data URL
//   col('#hex', a)  dith(x, y, coverage)  bayer(x, y)  keyOf(...)
//
// ---------------------------------------------------------------- PAPER (textures.ts)
//   paperTex(kind)             CSS image value of a seamless pixel tile (show it at 256px): 'journal' |
//                              'parchment' | 'kraft' | 'card' | 'telex' | 'flax' | 'graph' | 'blueprint' |
//                              'cork' | 'endpaper' | 'linen'   e.g. `${paperTex('blueprint')} 0 0 / 256px`
//   paperBg(kind, seed, age)   full CSS `background` for aged paper: pixel stains, foxing, creases and
//                              toasted edge strips over the tile. age: { stains, foxing, folds, edge, tint }
//   ageOverlay(seed, age)      just the age layers
//   coverTex('leather'|'cloth', '#hex')   book-cover material tiles
//   edgeClip(seed, { top, right, bottom, left: 'straight'|'deckle'|'torn'|'perforated', amp })
//                              a stepped clip-path polygon for ragged paper edges
//   paperTileCanvas(kind) / paperTileArt(kind)   the 128 x 128 tile (canvas / paint buffer)
//   ditherBg('#hex', coverage) a dither pattern background layer (pixel shadows and dimming)
//
// ---------------------------------------------------------------- INK & PENCIL (ink.ts)
//   Rough path data (deterministic per seed, in your own viewBox units):
//     roughLine(x1,y1,x2,y2,o)  roughRect(x,y,w,h,o)  roughEllipse(cx,cy,rx,ry,o)  roughCurve(pts,o)
//     roughArrow(x1,y1,x2,y2,bend,o) -> [shaft, head]  underline(w)  tick(size)  cross(size)
//     scribble(w,h)  strike(w)  tally(n,h) -> { d, w }
//     o = { rough, bow, seed, double }
//   svgInk(vw, vh, strokes, { w, h, cls, stretch })  -> a pixel canvas of the strokes (the old name)
//     stroke = { d, c (colour), w (width), fill, tex: 'pencil'|'ink', draw: seconds (draws itself on,
//                pixel by pixel), delay, opacity (dithered) }
//   rasterStrokes(art, vw, vh, strokes, stretch, t)   the same, into a paint buffer
//   INK, INK_BLUE, INK_RED, INK_GREEN, PENCIL colour constants
//
// ---------------------------------------------------------------- SKETCHES (sketch.ts)
//   sketchImg(src, o, cls, style)          a canvas that draws the sketch at a whole-number scale in
//                                          its box: o.box = [w, h] CSS
//   sketchURL(src, o): Promise<dataURL>    sketchCanvas(img|canvas, o)   (art resolution)
//     o = { style: 'pencil'|'ink'|'blueprint'|'chalk', wash 0..1, hatch 0..1,
//           crop: [x0,y0,x1,y1] (0..1), photo: true (find edges in colours, no alpha) }
//   doodle(name, { size, color, pencil, draw })   margin doodles in pixel ink: boat tent palm fish
//                              crab camera sun wave pug footprints pin star mountain fire bird shell
//                              leaf compass feather magnifier (doodleNames() lists them)
//
// ---------------------------------------------------------------- THINGS ON PAPER (decor.ts)
//   tape({ w, color, style })   pin({ color, style })   clip({ style })   pinURL(colour)
//   stamp(text, { color: 'red'|'blue'|'green'|'black', shape: 'box'|'round', small, fresh, rot, size })
//                              a pixel sprite, inked unevenly, drawn askew in pixel space
//                              (fresh = the stamp-down animation; pair with paperSfx('stamp'))
//   polaroid(imgURL, caption, { w, tape, pin, bg })   sticky(html, { color, w })
//   scrap(html, { kind, w, edges })   a torn bit of any paper (painted to its size)
//   paintSheet(art, kind, seed, edges, o)   the same paper, into a paint buffer
//   checkbox('todo'|'done'|'now'|'fail', seed, fresh)   struck(html, seed, fresh)
//   marked(html, { mode: 'under'|'circle'|'box', color, draw })   tallyMarks(n, of)   luggageTag(html)
//   tilt(seed) -> '0deg' (pixel art never rotates DOM)   tiltDeg(seed, max)   nudge(seed) -> a
//   translate() of whole art pixels   rotateArt(art, deg) (nearest neighbour)   escHtml(s)
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
//   The book's font-size is 20px (2 CSS px per pixel of the hand): size page text in whole ems.
//   Content flows over as many pages as it needs (measured with the real fonts). In page html, any
//   element with data-act="..." is a control: 'goto' (+ data-k = section id), 'next', 'prev', 'close',
//   or anything you handle in onAct. Elements with class .ppb-noturn never start a page turn.
//   Handle: goto(id, { page, instant })  next()  prev()  refresh(id?)  setSections(...)  close()
//           current()  visiblePages()  closed (Promise)  isOpen()
//   Turning: drag a page edge (the sheet folds and follows), click the outer edge, the arrows,
//   arrow keys / A D / PageUp PageDown, swipe on touch, digits 1-9 jump to tabs, Esc closes.
//   While a book is open the world is frozen (game.covered) and gameplay input is blocked.
//   bookOpen() is true while any book is open.
//
// ---------------------------------------------------------------- TRANSITIONS (transition.ts)
//   game.go(...) covers the screen with a pixel transition instead of the dissolve:
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
export { paperTex, paperBg, ageOverlay, coverTex, coverArtOf, edgeClip, paperTileCanvas, paperTileURL, paperTileArt, ditherBg } from './textures';
export type { PaperKind, AgeOpts, EdgeKind, EdgeOpts } from './textures';
export {
  roughLine, roughRect, roughEllipse, roughCurve, roughArrow, underline, tick, cross, scribble, strike, tally, svgInk, ensureDefs,
  rasterStrokes, flattenPath, parseColor, INK, INK_BLUE, INK_RED, INK_GREEN, PENCIL,
} from './ink';
export type { RoughOpts, Stroke } from './ink';
export { sketchURL, sketchImg, sketchCanvas, sketchReady, fillSketches, doodle, doodleNames, DOODLES } from './sketch';
export type { SketchOpts, SketchStyle } from './sketch';
export { tape, pin, pinURL, clip, clipURL, stamp, polaroid, sticky, scrap, paintSheet, paintTag, checkbox, struck, marked, tallyMarks, luggageTag, tilt, tiltDeg, nudge, rotateArt, escHtml } from './decor';
export type { CheckState } from './decor';
export { openBook, bookOpen } from './book';
export type { BookOpts, BookSection, BookBlock, BookTab, BookRibbon, BookLook, BookHandle } from './book';
export { setNextTransition, setDefaultTransition, setTransitionFocus, beginTransition, transitionFrame, transitionState } from './transition';
export type { TransitionStyle, TransitionOpts } from './transition';
export { paperSfx } from './sound';
export type { PaperSound } from './sound';
export { rng, hashStr, fbm, vnoise } from './rng';
export { PX, Art, pxCanvas, pxJob, paintNow, pxInvalidate, spriteURL, col, dith, bayer, keyOf, mixC, shadeC } from './px';
export type { Painter } from './px';
export { drawText, textWidth, textAscent, wrapText, installPixelFonts, HAND_FAMILY } from './pxfont';
export type { Face, TextOpts } from './pxfont';
