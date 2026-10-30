// V12 one clock for the loop: the island's day clock (0 morning .. 4 night, DayClock units) and the
// expedition clock (hours) map onto each other with the same keys the forest uses, so leaving the
// beach for the trails and walking back keep the sun where it was.

const KEYS: [number, number][] = [[5.5, 0], [7.5, 0.05], [12, 1], [16.5, 2], [18.75, 3], [20.5, 4]];

/** the island day clock for an hour of the day */
export function clockOfHour(h: number): number {
  if (h <= KEYS[0][0]) return 4;
  for (let i = 1; i < KEYS.length; i++) if (h <= KEYS[i][0]) { const [a, ta] = KEYS[i - 1], [b, tb] = KEYS[i]; return ta + ((h - a) / (b - a)) * (tb - ta); }
  return 4;
}
/** the hour of the day for an island day clock value */
export function hourOfClock(t: number): number {
  if (t <= 0) return KEYS[0][0];
  for (let i = 1; i < KEYS.length; i++) if (t <= KEYS[i][1]) { const [a, ta] = KEYS[i - 1], [b, tb] = KEYS[i]; return a + ((t - ta) / (tb - ta)) * (b - a); }
  return KEYS[KEYS.length - 1][0] + (t - 4) * 2;
}
/** 'half past four' style words for floating text */
export function hourWords(h: number): string {
  const hh = Math.floor(h) % 24, mm = Math.round((h - Math.floor(h)) * 4) * 15;
  const h12 = ((hh + 11) % 12) + 1, ap = hh < 12 ? 'am' : 'pm';
  return mm === 0 || mm === 60 ? `${h12}${ap}` : `${h12}:${String(mm).padStart(2, '0')}${ap}`;
}

/** the hour by which Mori should be heading home, and the hour Aroha comes looking */
export const DUSK_HOUR = 17.25, DARK_HOUR = 19.5, FETCH_HOUR = 20.5;
/** no setting off deeper after this (the trails refuse) */
export const LATE_HOUR = 16.5;
