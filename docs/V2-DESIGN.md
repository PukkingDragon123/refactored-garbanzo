# Project Zealandia — Version 2 design

Working design for the V2 rebuild. It is the contract between modules. When something here changes, update this file.

## Resolution and scale
- Internal art resolution: **VH = 360** art pixels, VW = clamp(round(360 × aspect), 540, 860), so 640 at 16:9. `REF_Y = 180`.
- Humans are about **62–72 px tall** (feet to top of head) and about 3 heads tall, in a chunky Dave-the-Diver style:
  - Aroha ≈ 72 with her topknot
  - Crowe ≈ 66 including the beanie
  - Rowan ≈ 64
  - Lou ≈ 60
  - Pip ≈ 58
- The ground line in side-scrolling scenes is usually world y ≈ 250–290. The camera y rests near 180.
- Animals, by approximate body length (or height):
  - Serpents: strider 70, sprinter 90, skyribbon 90, lure-viper 100, crag viper 80, mudribbon 120, titan 600 (radius 14), leviathan 900 (radius 24).
  - Crocodilians and lizards: ironjaw 220, bark gecko 30, pteramander 40.
  - Mammals: quillhog 36, shieldback 44, delver 26, sail possum 28 (span 50), flicker 44, boneface 100 long × 60 tall, hunter bat 40 tall.
  - Birds: gale hawk span 90, crag auk 30 tall, dipper 20, thunder stork 110 tall, monarch span 180, nutcracker 26.
  - Moss frog 18.

## Cast
| id | name | role | look (reference sheet `images/1.jpg`) |
|---|---|---|---|
| `rowan` | **Rowan Ellis** (player, they/them) | marine & terrestrial biologist, 20s | messy dark curly hair with a small top-knot, round black glasses, navy-blue parka with patches, white tee, olive cargo pants, grey hiking boots, big olive/tan backpack with a bedroll, camera on a strap, tan satchel, sample jar |
| `crowe` | **Captain Barnaby Crowe** | boat driver/navigator, 60+, English | red knit beanie, big white beard and moustache, pipe, cream shirt with rolled sleeves, navy dungarees, red neckerchief, anchor tattoo, brown belt with an anchor charm and keys, heavy brown boots. Gruff and secretly caring. |
| `aroha` | **Aroha** | Māori guide/tracker, 20s | tall and strong, dark hair in a high bun with feathers, subtle chin moko (kauae) marks, pounamu pendant, a flax cloak with a red/cream/brown pattern and feather fringe, cream top, dark woven skirt and belt, pouch, sandals, carries a taiaha (long wooden staff). Confident, warm and teasing. |
| `lou` | **Lou Tupou** | ship's cook | round and cheerful, headscarf, apron, ladle |
| `pip` | **Pip Nakamura** | engineer | young and small, goggles on the head, orange-and-grey overalls, wrench, grease smudges |

Tone: cosy, funny and warm. Treat Māori culture with respect. Aroha is highly competent and never a stereotype. Use correct te reo with macrons, with the meaning clear from context. Avoid sacred concepts (tapu, karakia, taniwha).

## Story
0. **The Voyage** (playable prologue, boat *Kittiwake*). On a calm sunny ocean you walk the cross-section boat: bow deck, wheelhouse (Crowe steering), galley (Lou; sit and eat), engine room (Pip), bunks and cargo hold.
   - Objectives: talk to the crew, eat lunch, and photograph a seabird as the camera tutorial with a review.
   - Then the storm: the sky darkens, the swell builds, and rain and lightning start. You secure 3 crates on the tilting deck while sliding.
   - A lightning flash reveals a huge finned silhouette (the Leviathan), then a giant wave rises and hits. Blackout.
1. **Castaways**
   - Wake-up on the beach: Rowan blinks awake beside the wrecked *Kittiwake* on the rocks. The crew staggers out of the surf, sounds off, and gathers.
   - Objective chain: salvage the wreck (canvas, poles, hammer) → **build the tent** yourself (hold to hammer; stages) → gather wood and stones → build the campfire → explore the jungle edge and collect a sample → Pip sets up the laptop → analyse the sample → dusk → sleep.
   - Night: a rustle in the bush. Investigate with the headlamp (heartbeat, spooky music) → JUMPSCARE: Aroha bursts out with her taiaha.
   - Translator-app comedy: she speaks te reo, and the app garbles and then dies. She laughs: "Kia ora. Put the phone away, it's butchering my language. I speak English."
   - Morning: she meets the crew and joins as guide. The 3D map unlocks.
2. **First Contact**: Fernwood Floor with Aroha. Photograph 3 species, then review the photos on the laptop.
3. **Up in the Trees**: Emerald Canopy (Skyribbon).
4. **Thunder Falls**: the colossal shed skin.
5. **The Titan**: Blackwater Mangroves.
6. **The Deep**: Pip rebuilds dive gear from the wreck → Serpent Coast → the Leviathan from the storm.
7. **Field Guide** (endgame): complete it. Pip's radio (a side-quest chain) reaches the mainland.

Side quests (see `src/game/quests.ts`): Crowe's lost pipe; Lou's island kitchen; Pip's radio parts; Aroha's snare lines and tracking lessons; photo requests from the crew.

## Systems (module → responsibility)
- `game/items.ts` ITEMS registry. `game/inventory.ts` holds backpack stacks plus the tool belt.
- `game/skills.ts` skill tree: branches camera / field / lab / survival, RP costs and prerequisites.
- `game/crafting.ts` workbench recipes. `game/quests.ts` quest definitions and progress. `game/lab.ts` laptop sample analysis.
- `game/photos.ts` raw (unreviewed) photos with per-subject metrics and the review/scoring API.
- `game/save.ts` save v2 (key `project-zealandia-save-v2`).
- `art/people.ts` characters v2, a skeleton renderer (bodies + heads with expressions + portraits). `art/emotes.ts` reaction icons.
- `art/beasts.ts` mammals, birds, frog, bat and insects as pose frames. `art/serpent.ts` spine renderer (serpents, crocodile, gecko, pteramander) with `art/fauna.ts` looks.
- `art/jungle.ts` dense flora and backgrounds. `art/castaway.ts` beach, wreck, camp structures, tent interior. `art/boat.ts` + `art/ocean.ts` Kittiwake cross-section, waves, storm.
- `ui/bubbles.ts` world-anchored speech bubbles with typewriter text, choices and shout/whisper/thought styles.
- `world/actor.ts` character drawable (body + head compositing, reactions, emotes, held items).
- `ui/backpack.ts`, `ui/craft.ts`, `ui/laptop.ts` (Samples, Photos review, Skills, Field Guide, Quests), `ui/map3d.ts`.
- Renderer: `pushTransform/popTransform` for rigid bodies (the boat).

## Camera v2 rules
- Capture records, for every creature in frame:
  - bbox (normalised), visible fraction (occlusion by foreground props and terrain), sharpness (focus × motion × shake)
  - size in frame, facing, action/behaviour, noticed flag
- Obstruction: foreground occluder props register alpha masks. A capture samples the subject's silhouette points against them.
- AF picks the nearest object under the AF point. A leaf in front can steal focus.
- Motion blur ∝ subject screen speed × shutter time. Shake blur ∝ handheld sway; it drops when you crouch or brace, and with the steady skill or tea.
- The blur is baked into the stored thumbnail.
- Photos are stored **raw** and need review. In review you click each subject to tag it, and identification succeeds only if the subject is visible ≥ 0.45 and sharp ≥ 0.4.
  - Stars come from framing, size, sharpness, visibility, behaviour, rarity and light.
  - A successful review grants species seen, evidence and RP.

## Animal AI v2 (wildlife)
Perception: vision cone plus line-of-sight through cover, hearing (player noise, calls) and smell (lures, wind). Each species has a temperament: boldness, aggression, curiosity, sociality, alertness, and rarity/spawn chance.

Moods are calm / curious / alert / afraid / aggressive / playful / sleepy. Behaviours:
- Movement and rest: wander, forage/graze, rest, sleep, bask
- Predation: stalk, chase, attack, eat
- Evasion: flee, hide, freeze
- Communication: alarm call, contact call, threat display
- Social: play (juveniles), groom, follow the group leader, investigate (curious approach), mob (birds vs vipers)

Emote icons show state: ? ! ♥ 💢 zzz ♪. Groups and species interact through predator/prey/competitor tables, and alarm calls propagate across species.
