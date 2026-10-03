# Project Zealandia

A 2.5D pixel-art wildlife photography and ecosystem research game, in the spirit of *Dave the Diver*.

You are **Otis Finch**, photographer on an Antarctic research voyage. A storm blows the *Southern Wren* four hundred kilometres off course, and at dawn the fog lifts on a continent that isn't on any chart: **Zealandia**. After eighty million years of isolation, serpents became the dominant animals here instead of birds. There are legged forest serpents, gliding tree snakes, a sixteen-metre constrictor, and a finned marine leviathan with feathery gills. Everything else had to adapt around them: armoured and quilled mammals, cliff-nesting birds, gliders, and serpent-eaters.

Set up base camp, drive the jeep out to the sites, hide, lure, and photograph the wildlife. Then piece together how the ecosystem works in the Field Guide.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run build:single   # one self-contained HTML file in dist-single/
```

The game needs a browser with WebGL2 (any recent Chrome, Edge, Firefox or Safari). It is built for mouse and keyboard.

| Action | Keys |
|---|---|
| Walk / run | `A` `D` or arrows, hold `Shift` to run (noisy) |
| Crouch / hide in a bush or reeds | `S` (next to a bush) |
| Jump / climb vines | `Space` / `W` |
| Interact, collect clues | `E` or click |
| Raise camera | hold right mouse, or toggle with `Q` |
| Shoot / record | left click |
| Zoom | mouse wheel (or `Z` / `X`) |
| Photo / video mode | `V` (needs the video module) |
| Pick and place gadget | `1`-`5`, then `F` |
| Field journal (quests) | `J` |
| Zealandia Encyclopedia | `G` |
| Pause | `Esc` |

## How it plays

* **Base camp** is a side-scrolling hub. Talk to the crew: Dr. Imogen Vance (expedition lead and research desk), Pip (gear workshop), Bolt (the jeep *Beatrice*), Mama Lou (meals that buff your next trip) and Sid (radio rumours about species you haven't found). The hammock passes time.
* **The jeep map** takes you to five sites (Fernwood Floor, Emerald Canopy, Thunder Falls, Blackwater Mangroves, Serpent Coast) at dawn, midday, golden hour or night. Different animals are active at different times.
* **The camera** zooms, autofocuses (the focus box turns green when it locks) and has real depth of field. Each photo is graded on subject size, composition, focus, behaviour, whether the animal was unaware of you, rarity, light, and whether two species are interacting.
* **Stealth**: animals notice you by sight and noise. Crouch, hide in bushes, and use lures (fruit, grubs, fish, a bird caller) and camera traps. Dangerous animals (the Sprint Viper, the Ironjaw crocodile, the Titan Constrictor) will go for you if they spot you.
* **The Field Guide** holds 18 species and 54 facts. A photo of an animal *doing something* is evidence. Some facts need a video, a field clue, or evidence about a *different* species. Once you have the evidence for a fact, deduce it at the research desk.
* **The story** runs in chapters, from the opening voyage cutscene to the Titan in the mangroves and a dive with the Leviathan, then a finale at the campfire. After that you're free to complete the guide.

## Tech

Everything is generated at runtime: no image or audio files.

* `src/gfx`: a WebGL2 2.5D sprite renderer. It draws parallax layers with `zoom^p` dolly zoom and pixel-art anti-aliased sampling. A multi-render-target scene pass writes albedo, fog, emissive, light-receive, water and depth. A light-map pass handles point lights, god-ray cookies and caustics. The composite pass does lighting, fog and screen-space water reflections. After that come additive FX, half-resolution depth of field, dual-filter bloom, and a final grade with vignette, grain, chromatic aberration and a dithered dissolve fade.
* `src/art`: a software pixel painter (`PixelBuffer`) and procedural painters for the sky, mountains, tree lines, tree ferns, kauri, nikau palms, mangroves, camp props and the ship. It also has a paper-doll character renderer for the crew, a spine-based serpent renderer (legs with IK, fins, gill fronds, patterns, jaws, tongues) and posed bird and mammal generators.
* `src/game`: scenes (title, intro, camp, travel, expedition), the wildlife AI, the camera and grading system, research and deduction, story, and saves (localStorage).
* `src/core/audio.ts`: fully synthesized WebAudio ambience, SFX and generative music.

Debug helpers: `?scene=camp&tod=night`, `?scene=site&site=falls&tod=dusk&ch=3`, and `?gallery=flora|land|camp|chars|fauna`.
