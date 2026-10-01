// V9 island shore life, painted with the beasts sketch core (z-buffered implicit surfaces, OKLab
// ramps, tinted outlines) and registered as beasts so the field guide, the wild bodies and
// renderAny all know them. Everything faces right; see each module for anatomy and anims.
//
//   corvexseal   Corvex Seal            seal.ts
//   crownleech   Crown Leech            leech.ts      (parasite of the Corvex Seal)
//   glasscrab    Glass Crab             crab.ts
//   swashrunner  Swashrunner            birds.ts
//   shellwrench  Pied Shellwrench       birds.ts      (wrack-line shorebird with a crossed bill)
//   twinfan      Twinfan                birds.ts      (double-fan-tailed bush flycatcher)
//   duskwaddler  Duskwaddler            waddler.ts    (fur-feathered, shovel-footed dune burrower)
//   kelpskink    Kelp Skink             skink.ts
//   periscope    Periscope Octopus      octopus.ts    (armour-plated rock-pool octopus)
//   starweb      Starweb Weaver         starweb.ts    (the sea cave's glowing fisher-grubs)

import { registerBeast, renderAny, BeastFrame, BeastEye } from '../../beasts';
import type { SpeciesDef } from '../../beasts-core';
import type { PixelBuffer } from '../../pixel';
import { CORVEXSEAL } from './seal';
import { CROWNLEECH } from './leech';
import { GLASSCRAB } from './crab';
import { SWASHRUNNER, SHELLWRENCH, TWINFAN } from './birds';

/** a painter plus optional post-processing of the resolved frame (translucency, glow masks) */
export interface ShoreDef extends SpeciesDef {
  /** runs on a copy of each resolved frame (e.g. see-through shell pixels) */
  post?(buf: PixelBuffer, anim: string, frame: number): void;
  /** optional emissive mask for glowing parts: pixels to draw additively after lighting */
  glow?(buf: PixelBuffer, anim: string, frame: number): PixelBuffer | null;
}

const DEFS: Record<string, ShoreDef> = {
  corvexseal: CORVEXSEAL,
  crownleech: CROWNLEECH,
  glasscrab: GLASSCRAB,
  swashrunner: SWASHRUNNER,
  shellwrench: SHELLWRENCH,
  twinfan: TWINFAN,
};

export const SHORE_IDS = Object.keys(DEFS);
for (const [id, def] of Object.entries(DEFS)) registerBeast(id, def);

export interface ShoreFrame extends BeastFrame {
  /** additive glow layer for this frame (same size and anchor), if the species glows */
  glowBuf: PixelBuffer | null;
}

const cache = new Map<string, ShoreFrame>();
/** One frame of a shore species (cached), post-processed and with its glow mask. */
export function shoreFrame(id: string, anim: string, frame: number, eye?: BeastEye): ShoreFrame {
  const def = DEFS[id];
  const n = def?.anims[anim]?.frames ?? def?.anims.idle?.frames ?? 1;
  const f = ((Math.floor(frame) % n) + n) % n;
  const key = `${id}|${anim}|${f}|${eye ?? ''}`;
  let c = cache.get(key);
  if (!c) {
    const src = renderAny(id, anim, f, eye);
    const buf = def?.post ? src.buf.clone() : src.buf;
    def?.post?.(buf, anim, f);
    c = { ...src, buf, glowBuf: def?.glow?.(buf, anim, f) ?? null };
    if (cache.size > 900) cache.delete(cache.keys().next().value!);
    cache.set(key, c);
  }
  return c;
}

/** anim table of a shore species */
export function shoreAnims(id: string) {
  return DEFS[id]?.anims ?? {};
}
