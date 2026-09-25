// Persistent game state (localStorage, wrapped defensively).

import type { SiteId } from './species';
import type { TimeOfDay } from '../world/timeofday';

export interface PhotoRecord {
  id: number;
  species: string | null;
  behavior: string | null;
  others: string[];
  stars: number;
  score: number;
  site: SiteId;
  time: TimeOfDay;
  video: boolean;
  thumb: string;
  notes: string[];
}

export interface SaveData {
  version: number;
  chapter: number;
  flags: Record<string, boolean>;
  rp: number;
  totalRp: number;
  upgrades: Record<string, number>;
  items: Record<string, number>;
  seen: Record<string, boolean>;
  evPhoto: Record<string, boolean>;
  evVideo: Record<string, boolean>;
  clues: Record<string, boolean>;
  facts: Record<string, boolean>;
  best: Record<string, { thumb: string; stars: number; behavior: string | null }>;
  album: PhotoRecord[];
  sites: SiteId[];
  day: number;
  campTime: TimeOfDay;
  settings: { music: number; sfx: number; quality: number };
  photoId: number;
}

const KEY = 'project-zealandia-save-v1';

export function newSave(): SaveData {
  return {
    version: 1, chapter: 0, flags: {}, rp: 60, totalRp: 0,
    upgrades: { lens: 1, af: 1, film: 1, video: 0, headlamp: 0, dive: 0, ghillie: 0 },
    items: { fruit: 2, grub: 2, fish: 0, caller: 0, trap: 0 },
    seen: {}, evPhoto: {}, evVideo: {}, clues: {}, facts: {}, best: {}, album: [],
    sites: ['fernwood'], day: 1, campTime: 'dusk',
    settings: { music: 0.6, sfx: 0.8, quality: 1 }, photoId: 1,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    const base = newSave();
    return { ...base, ...d, upgrades: { ...base.upgrades, ...d.upgrades }, items: { ...base.items, ...d.items }, settings: { ...base.settings, ...d.settings } };
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData) {
  try {
    // keep the album bounded so we stay well under storage limits
    if (d.album.length > 40) d.album = d.album.slice(-40);
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    try {
      d.album = d.album.slice(-10);
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch { /* storage unavailable */ }
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
