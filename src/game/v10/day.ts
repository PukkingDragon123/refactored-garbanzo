// V10 day loop at camp: wake up, camp life, expedition, return, upload, sleep, next day.
// (Contract stub: the camp module fills this in.)

export function dayNumber(): number { return 1; }
/** called by the expedition module when Mori is back at camp */
export async function arriveAtCamp(how: 'walk' | 'blackout' | 'boat'): Promise<void> { void how; }
