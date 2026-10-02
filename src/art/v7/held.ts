// V7 held objects: the real things the cast carry, modelled in the same 3D scene as the body so they
// sit in the hands and overlap the arms and fingers correctly (filled in below).

import type { Pose } from '../people-rig';
import type { Char7, J3 } from './body';
import type { HandFrame } from './hands';
import type { Scene3D, V3 } from './raster';

export type HeldDraw = (s: Scene3D, J: J3, P: Pose, ch: Char7, hN: HandFrame | null, hF: HandFrame | null, pts: Record<string, V3>) => void;
export const HELD7: Record<string, HeldDraw> = {};

export function drawHeld7(s: Scene3D, J: J3, P: Pose, ch: Char7, hN: HandFrame | null, hF: HandFrame | null, pts: Record<string, V3>) {
  const k = P.held?.kind;
  if (!k) return;
  const layer = s.layer;
  HELD7[k]?.(s, J, P, ch, hN, hF, pts);
  s.layer = layer;
}
