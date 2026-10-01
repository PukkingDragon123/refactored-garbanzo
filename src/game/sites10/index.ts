// V10 sites: the deeper places of the region, built with the V2 site toolkit (sites2/common.ts) and
// the V10 kit (kit.ts). Each is a FieldSite with its own location id and V10 extras (finds, water to
// swim, hazards, hard climbs) that the expedition runtime (v10/field10.ts) reads.

import type { Site10 } from './kit';

export const SITES10: Record<string, Site10> = {};
