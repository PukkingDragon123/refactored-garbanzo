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
- Every UI piece is a super-detailed physical object. Timers and the clock are Mori's modern field watch
  (user, latest: "real modern watch, cool, interactive, show stamina"; `src/ui/v12/watch.ts`), never a bar
  or a bare number: a rugged composite case, a steel compass bezel, four pushers and a colour display
  with the time, stamina (its ring) and how long until dark. Click it (or press C) and it comes up big as
  a working menu (`src/ui/v12/fieldwatch.ts`: clock, body, sun, compass, quest, shortcuts).
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
- Characters (user, latest: "make the people a lot better, realistic anime, not ugly and chopped"):
  the painted anime cast at its fine density, two buffer pixels per world pixel (`CAST_DENS7 = 2` in
  `src/art/v7/body.ts`, `TOON7 = false` in `raster.ts`). That means smooth form shading, fabric
  folds, strand hair with its angel ring, rim light, and the realistic sprite face (`facereal.ts`, below).
  The cartoon finish and face (`facetoon.ts`) are kept, unused. Mori is a normal, fit build, never
  skinny. Women and girls are listed in `FEM7`.
  - **Proportions: stylised like Dave the Diver, anatomy in the joints** (user, latest: "the body and
    face and neck looks uncanny, study how Dave the Diver makes it look good and normal"; before that,
    "make it anatomically accurate"). Purely measured anatomy (7.4 heads, a long thin neck) was
    uncanny at sprite size. Every adult goes through `anat()` in `src/art/v7/restyle.ts` (the `STYLE`
    table): men 5.7 heads tall, women 5.55, so the face reads; a short, thick neck (0.024 H, women
    0.03 H; radius about 0.26 of the head's height for men, 0.21 for women) so the head sits on the
    shoulders; torso 0.3 H; arms a touch short (upper arm 0.172 H, forearm 0.138 H). The landmarks
    stay anatomical: the knee halfway down the leg (thigh/shin/ankle 0.463/0.463/0.074 of it), the
    elbow at the waist, the wrist at the crotch. `headScale7` follows it. Children are left as they
    are. Change proportions in that table, never by hand-tuning a build's segment lengths.
  - **Heads and faces (user, latest: "make it realistic like a real human face ... low resolution but
    polished", after "the head shape looks ugly" and "not like circles mashed together").** The head
    is one sculpted form, not ellipsoids pushed together: `headForm()` in `src/art/v7/headsdf.ts`
    lofts the head from cross-sections through each character's own landmarks (an egg-shaped skull, a
    flat face front for the eyes, the jaw running from its angle under the ear to a chin about a third
    of the face's width), with a subtle brow ridge, eye sockets, nose, nostril wings and lips, rendered
    by `Scene3D.sdf` (`HEAD_SDF7 = true` in `head.ts`). Its skin is smoothed and shaded in four clean
    tones, no speckled terminator. The sprite face is `facereal.ts`: an upper lid line over the iris
    with its catch-light inside, only a sliver of shaded white, tapered brows, a lip line with a
    shadow under the lower lip. The detailed (`facemid.ts`) and bead-eyed (`facesimple.ts`) faces are
    kept, unused. Judge faces only at the game's sprite size, never from enlarged debug renders.
  - The head meets the neck with no inked line: the edge under the jaw is the jaw's shadow in a deep
    skin tone (`renderHead7`); a black line there reads as a choker.
  - **Bodies (user: "the mc is too skinny ... less like a bunch of sticks").** Limbs are shaped, not
    tubes: `limb()` takes a radius profile, and `body.ts` swells the thigh, calf, upper arm and forearm
    (`PROF_*`). `STYLE` in `restyle.ts` gives every adult fuller arms and legs and hands that read;
    Mori is a fit young man with a full chest and real arms and legs (`realBuild`). The shoulders are
    a sloping trapezius with a deltoid cap, never a tube straight across.
- **Never show the player's first-person hands** (user: "never ever show player first person
  hand"). Close-ups show the tools and what they touch, not Mori's hands or sleeves
  (`FIRST_PERSON_HANDS = false` in `src/ui/v12/closeup/hands.ts`, `HANDS3D.enabled = false`).
- Never use emoji. Use painted pixel icons (`src/ui/pxicons.ts`).
- Never show the HD close-up face as a small profile portrait in the HUD, and no dialogue close-up
  cut-ins either (user: "remove the zoom-in dialogue close-up face"; `CLOSEUP_CUTINS = false` in
  `src/ui/bubbles.ts`). Every line floats by its speaker in the world.
- The quality bar is the best scenes in the game, such as the palm beach and the great forest.
  - Nothing should look like a rectangle pasted into the world. No cropped sprites.
  - Sprites stand on the ground they belong to; trunks and canopy run out of frame.

## V12 design: zero traditional UI and a clear loop (always)

- **HUD (user, latest): the classic HUD is back**, every piece a detailed physical pixel-art object.
  It includes the pinned objective note, the research stamp, the field-watch clock, the place
  banner and the kit (`src/ui/v11/hud2classic.ts`, mounted by `src/ui/hud2.ts` via `CLASSIC_HUD`).
  There's no top-left status plate (medallion, flask or weight scale) and no research-point counter;
  the user removed both. The HUD is only what's useful: the objective note, the field-watch clock,
  and the kit as real icon buttons (backpack, field guide, laptop, camera). No decoration-only UI.
- The user likes the floating-word menu style (title, pause, settings). Use that style for any text
  the HUD still needs (place names, prompts), not plates or boxes.
- **UI resolution (user, latest):** full resolution was "too high"; the user wants "not that high
  resolution ... polish cool interactive". Icons are pixel art at about 2 device px per art pixel
  at 1280×720, scaled with the screen (`kitPx()` in `hud2classic.ts`). That's crisp, visible
  pixels, neither the old chunky 3 px nor full resolution. Buttons are interactive: a hover label in
  the menu font, a per-icon reaction, a press squash and a click effect. The kit itself (user, latest: "the kit lower
  resolution, felt like real pixel art, handmade") is hand-made 26 x 26 pixel sprites
  (`src/ui/v12/kitsprites.ts`, a small palette, placed pixel by pixel) drawn by `src/ui/v12/kitpix.ts` at
  a whole number of device px per sprite pixel (3 at 1280x720): an idle loop (the mug and tag swing, the
  ribbon sways, glints, the camera's ready light and lens streak), hover opens them (the flap lifts, the
  cover opens on a kiwi sketch, the lens racks out and the flash charges), a click fires the flash. There are still no dialogue boxes or menu boxes; everything else is in the
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
- **Stamina is back (user, latest), no fast travel.** Shift sprints (fast and loud); sprinting,
  climbing and swimming use stamina, easing off refills it, hunger caps it, and running it out leaves
  Mori winded for a moment (`src/game/v12/stamina.ts`). It is read on the field watch's ring.
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

## Where the newer systems live

- **Photos:** a picture already on file pays nothing, a better one pays the difference
  (`src/game/v12/shotvalue.ts`; shown on the print, the aiming ring and the upload).
- **Te Kāinga** is 4000 px wide:
  - Te Huarahi, the multicultural market lane: `src/art/v11/village/quarter.ts`, `clutter.ts`,
    `src/game/v11/village/quarter.ts`.
  - The ground is three parallax bands painted as a ground plane: `floor.ts`, `floorbands.ts`.
- **Te Tuawhenua, the backcountry:** a 14,000 px map generated from one seed
  (`src/game/v12/backcountry/gen.ts`). Modules attach through `tuaHooks` (`hooks.ts`).
- **Matikuku Nui (the Bearer) and Huruhuru (the feathered boa):** `src/game/v12/feud/` (director API at
  the top of `director.ts`), art in `src/art/v12/feud/` and the serpent painter's `feathers` option.
- **The night of the claw, the village boss fight:** `src/game/v12/raid/`.
- **Big Hank the dealer:** `src/game/v11/npcs/hank.ts`; his barter wares are in `src/ui/v12/wares.ts`.
- **The weapon belt:** `src/game/v12/arsenal*.ts`. T cycles weapons, G fires; there are no hit
  points, weapons spend nerve and darts put a predator to sleep.
- **Statues:** always one of the island's animals, organic and ruined (`src/art/v12/statues.ts`).
- **The wild's encounters** (user: "more props and wildlife that's actually cool and unique you can
  interact with"): `src/game/v12/wild/encounters.ts` places them in Te Tuawhenua (`WILD`), clear of the
  feud's arena and signs. Roll rotten logs over (a heave) for huhu grubs and, in the feathered gully,
  a velvet worm (ngaokeoke) that squirts glue; knock on the old rimu for the ruru; drop a grub into the
  creek's deep pool for the longfin eel (tuna); sit in the dark under the overhang for the glow-worms
  (titiwai, a photo subject that only counts in the dark); soak your feet in the hot pools at the gorge's
  end (stamina) and steam huhu over the vent; kea on the burnt ridge raid an open pack. The animals:
  `./birds.ts` (kea, ruru), `./crawlers.ts` (tuna, ngaokeoke), each with a `*_CTX` the scene fills in;
  the props: `src/art/v12/wild/encounters.ts`. New encounters should be things to do, feed each other,
  and get a first-visit hint line.
- **Rooms behind doors and windows:** never a black hole. `src/art/v11/village/interior.ts` paints the
  room (home, meeting house, store) lit by the opening; use `paintDoorway` / `paintWindowRoom` for any
  new building.

## Working notes

- The user reviews gameplay themselves. Verify with `npx tsc --noEmit` and
  `npm run build:artifact`, and take only the screenshots needed to judge visual work.
- Load the build as `dist-single/index.html`; `zealandia.html` is the body-only artifact page.
  Debug params live in `src/main.ts`. The Developer panel is in Settings, and its story points are
  in `src/debug/devpoints.ts`.
