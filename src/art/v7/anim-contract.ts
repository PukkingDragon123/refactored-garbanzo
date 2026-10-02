// V11 contract: animation names other modules may ask the V7 cast for. The cast / Aroha / hands
// modules add these to ANIMS7 (src/art/v7/anims7.ts); callers check hasAnim7 and fall back.
import { ANIMS7 } from './anims7';

/** Aroha's (and Mori's slingshot) combat set */
export const COMBAT_ANIMS = ['slingReady', 'slingDraw', 'slingRelease', 'grenadeThrow', 'flipBack', 'dashStrike', 'roll', 'landCrouch', 'vault', 'dodge'] as const;
/** handling real objects */
export const HANDS_ANIMS = ['carryIdle', 'carryWalk', 'cupWater', 'cupWalk', 'backpackOff', 'backpackOn', 'kneelWork', 'craft', 'stir', 'chop'] as const;

export function hasAnim7(anim: string): boolean { return !!ANIMS7[anim]; }
