// V10 sites: the deeper places of the region, built with the V2 site toolkit (sites2/common.ts) and
// the V10 kit (kit.ts). Each is a FieldSite with its own location id and V10 extras (finds, water to
// swim, hazards, hard climbs) that the expedition runtime (v10/field10.ts) reads.

import type { Site10 } from './kit';
import { GROTTO } from './grotto';
import { FOSSILS } from './fossils';
import { GLOWFOREST } from './glowforest';
import { GEOVALLEY } from './geovalley';
import { RUINS } from './ruins';
import { UNKNOWN } from './unknown';
import { VILLAGE } from './village';

export const SITES10: Record<string, Site10> = {
  grotto: GROTTO, fossils: FOSSILS, glowforest: GLOWFOREST, geovalley: GEOVALLEY, ruins: RUINS, unknown: UNKNOWN, village: VILLAGE,
};
