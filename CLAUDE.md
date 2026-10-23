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

## V12 design: zero traditional UI and a clear loop (always)

- **No HUD, no panels, no menu boxes.** Everything the player needs is in the world or on objects:
  - **Text:** all text floats in the world. Dialogue is simple floating text by the speaker, with
    lively per-letter animation: shouts shake and grow, whispers waver, scared text trembles. The same
    goes for barks, prompts and notices. No dialogue boxes, no toasts.
  - **Mori:** click or tap Mori (or press Tab) to inspect him. The camera eases in close, and three
    things on him can be picked: the camera (equip or unequip), the backpack (a detailed
    first-person backpack scene with a 5×3 grid; items can be rotated) and the note paper (pulled
    out as a detailed notebook with real page flips; quests are ticked with an animated pen; you can
    draw on it; it also holds the field guide and people).
  - **Main menu:** a cinematic scene of the boat sailing with Mori on deck. The title is a cloud
    formation in the sky and the options are floating text. The pause and settings menus also use
    floating text over the scene.
- **No stamina, no sprint, no fast travel.**
  - **Hunger:** Mori's stomach growls (a sound and an animation). When he's too hungry he refuses to
    take photos until he eats.
  - **Travel:** you walk everywhere. Trails link the areas, with signposted crossroads where paths
    split. Camp is the hub.
- **The loop:** wake at camp; talk, eat and check the notebook; walk out along the trails; explore,
  photograph wildlife and collect samples; walk back before dark; develop and research the photos;
  cook; sleep. Research unlocks blueprints, and the gear you craft from them opens new trails.
- **Hard-won progress:** nothing comes all at once. Rare animals need patience and skill. Gathering
  and tricky moments use short QTE minigames. The model is how Dave the Diver polishes its loop.
- Features that clutter the loop are hidden rather than deleted, so they can return.

## Working notes

- The user reviews gameplay themselves. Verify with `npx tsc --noEmit` and
  `npm run build:artifact`, and take only the screenshots needed to judge visual work.
- Load the build as `dist-single/index.html`; `zealandia.html` is the body-only artifact page.
  Debug params live in `src/main.ts`. The Developer panel is in Settings, and its story points are
  in `src/debug/devpoints.ts`.
