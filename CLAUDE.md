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
- Every UI piece is a super-detailed physical object. Timers are a real vintage pocket watch
  (`src/ui/v12/watch.ts`), never a bar or a bare number.
- Every asset is hand-drawn pixel art, placed pixel by pixel with hand-picked clusters. Don't
  build things by sticking primitive shapes together: no circle or ellipse rocks, no blob fossils,
  no stacked-rectangle props. That covers world art, item icons and UI. Rocks, fossils, plants and
  props need irregular hand-shaped silhouettes, readable form shading, texture, cracks and
  highlights. If the code draws with `arc` or `ellipse`, it's only for a rough base that is then
  hand-detailed, never the final look.
- Everything feels organic and alive (user: "every asset shape and detail felt handdrawn organic
  and interactive add plant physics and wind"). Plants, grass, ferns, reeds, vines and leaves sway in
  the scene's wind with gusts, and bend away when Mori or animals walk through them, then spring back.
  New foliage opts into the shared plant physics (`src/world/foliage.ts`: `Prop` option
  `foliage: 'grass' | 'fern' | 'bush' | 'reed' | 'flower' | 'vine' | 'plant' | 'tree'`, `GroundCover`,
  `st.windField`). Organic painters live in `src/art/organic.ts`.
- Characters (user, latest): lower resolution and more cartoony. The cast is drawn at 1 pixel per
  world pixel (`CAST_DENS7 = 1` in `src/art/v7/body.ts`), with bigger heads (about 4.5–5 heads),
  bold outlines, 2–3 tone flat cel shading and brighter colours (`TOON7` in `raster.ts`). Faces are
  the cartoon face in `facetoon.ts`, with clear 2×2/2×3 eyes plus a highlight and distinct mouths
  per expression. The older mid, anime and dot faces are kept unused. Mori is a normal, realistic
  build, not skinny. Women and girls are listed in `FEM7`.
- **Never show the player's first-person hands** (user: "never ever show player first person
  hand"). Close-ups show the tools and what they touch, not Mori's hands or sleeves
  (`FIRST_PERSON_HANDS = false` in `src/ui/v12/closeup/hands.ts`, `HANDS3D.enabled = false`).
- Never use emoji. Use painted pixel icons (`src/ui/pxicons.ts`).
- Never show the HD close-up face as a small profile portrait in the HUD.
- The quality bar is the best scenes in the game, such as the palm beach and the great forest.
  - Nothing should look like a rectangle pasted into the world. No cropped sprites.
  - Sprites stand on the ground they belong to; trunks and canopy run out of frame.

## V12 design: zero traditional UI and a clear loop (always)

- **HUD (user, latest): the classic HUD is back**, every piece a detailed physical pixel-art object.
  It includes the pinned objective note, the research stamp, the pocket-watch clock, the place
  banner and the kit (`src/ui/v11/hud2classic.ts`, mounted by `src/ui/hud2.ts` via `CLASSIC_HUD`).
  There's no top-left status plate (medallion, flask or weight scale) and no research-point counter;
  the user removed both. The HUD is only what's useful: the objective note, the pocket-watch clock,
  and the kit as real icon buttons (backpack, field guide, laptop, camera). No decoration-only UI.
- The user likes the floating-word menu style (title, pause, settings). Use that style for any text
  the HUD still needs (place names, prompts), not plates or boxes.
- **UI resolution (user, latest):** full resolution was "too high"; the user wants "not that high
  resolution ... polish cool interactive". Icons are pixel art at about 2 device px per art pixel
  at 1280×720, scaled with the screen (`kitPx()` in `hud2classic.ts`). That's crisp, visible
  pixels, neither the old chunky 3 px nor full resolution. Buttons are interactive: a hover label in
  the menu font, a per-icon reaction, a press squash and a click effect. There are still no dialogue boxes or menu boxes; everything else is in the
  world or on objects:
  - **Text:** all text floats in the world. Dialogue is simple floating text by the speaker, with
    lively per-letter animation: shouts shake and grow, whispers waver, scared text trembles. The same
    goes for barks, prompts and notices. No dialogue boxes, no toasts.
  - **Mori:** press Tab or I to inspect him. Clicking or tapping Mori does nothing (user removed it);
    the kit's icon buttons open the pack, guide and camera. The camera eases in close, and three
    things on him can be picked: the camera (equip or unequip), the backpack (floating UI over
    the world, never a first-person scene: the pack lifts off his back and opens in the air as a
    super-detailed pixel-art object with a 5×3 grid; items can be rotated) and the note paper (pulled
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
