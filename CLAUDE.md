# Project Zealandia: standing rules

A 2D side-view pixel-art game (Vite + TypeScript strict, custom WebGL2 renderer, DOM overlay UI).

## Art direction (always)

- **Every UI element and every piece of on-screen text is pixel art.** That includes the HUD, menus,
  books, papers and notes, maps, the backpack, the laptop, minigame overlays, toasts, prompts and the
  developer panel.
  - Use pixel fonts only: Jersey 10/15, Pixelify Sans, Silkscreen, or bitmap fonts drawn in code.
    No smooth or handwriting web fonts such as Caveat. "Handwriting" means a pixel script font.
  - Keep pixels crisp: integer scaling, `image-rendering: pixelated`, hard pixel edges.
  - No anti-aliased vector strokes, CSS blur, smooth gradients or soft shadows. If you need a
    gradient or shadow, dither it or quantise it.
  - Paper, ink, stamps, tape and pins are painted as pixel art.
- The UI should be present and look great. Make it cool, stylish and physical, in the spirit of
  Dave the Diver: a proper stamina gauge, gauges and tags. Don't strip things away until it's bare.
- Never use emoji. Use painted pixel icons (`src/ui/pxicons.ts`).
- Never show the HD close-up face as a small profile portrait in the HUD.
- The quality bar is the best scenes in the game, such as the palm beach and the great forest.
  - Nothing should look like a rectangle pasted into the world. No cropped sprites.
  - Sprites stand on the ground they belong to; trunks and canopy run out of frame.

## Working notes

- The user reviews gameplay themselves. Verify with `npx tsc --noEmit` and
  `npm run build:artifact`, and take only the screenshots needed to judge visual work.
- Load the build as `dist-single/index.html`; `zealandia.html` is the body-only artifact page.
  Debug params live in `src/main.ts`. The Developer panel is in Settings, and its story points are
  in `src/debug/devpoints.ts`.
