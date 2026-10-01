// V10 expedition flow: leave camp for a location, come home on foot, by boat, or carried after a
// blackout. (Contract stub: the map/expedition module fills this in.)

export type ReturnHow = 'walk' | 'blackout' | 'boat';
/** the location being explored, or null at camp */
export function currentExpedition(): string | null { return null; }
export async function goExpedition(locId: string): Promise<void> { void locId; }
/** back to the camp scene; the day module plays the arrival cutscene for `how` */
export async function returnToCamp(how: ReturnHow): Promise<void> { void how; }
