// Ladder geometry shared by the ladder art (the Kittiwake's ladders in boatInterior.ts, the rope ladder
// at the wreck) and the climbing animation (v7/anims7.ts), so hands and feet land on painted rungs.
//  - rungs every RUNG_PITCH px, the first RUNG_OFF px below the top (the deck / floor the ladder leads to)
//  - the rails run on up past the top as handrails, GRAB_H px high: hands hold them while stepping on/off
//  - rails RAIL_X px either side of the ladder's x (their inner edge), RAIL_W px wide; rungs between them

export const RUNG_PITCH = 6, RUNG_OFF = 3, GRAB_H = 24;
export const RAIL_X = 7, RAIL_W = 3;
/** where a climber's hands go across the ladder (px either side of its x, on screen) */
export const GRIP_X = 8;

/** climb frames: d px below the top (exact for the first C_TOP, then periodic every C_CYC) x px above the floor (0..C_BOT-2, C_BOT-1 = clear of it) */
export const C_TOP = 60, C_CYC = 12, C_BOT = 13;
export const CLIMB_FRAMES = (C_TOP + C_CYC) * C_BOT;

/**
 * The climb clip is not timed: its frame IS the climber's place on the ladder. d px below the top of a
 * ladder L px long → frame. Mid-ladder frames repeat every 12 px (two rungs), so a climber drawn at
 * top + round(d) keeps every planted hand and foot on the same rung pixel row from frame to frame, and
 * stops dead on the rungs when he stops.
 */
export function climbFrame(d: number, L: number): number {
  L = Math.max(0, Math.round(L));
  d = Math.max(0, Math.min(L, Math.round(d)));
  const e = Math.min(C_BOT - 1, L - d);
  const dd = d < C_TOP ? d : C_TOP + ((d - C_TOP) % C_CYC);
  return dd * C_BOT + e;
}
