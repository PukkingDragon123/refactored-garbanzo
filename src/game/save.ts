// Persistent game state (localStorage, wrapped defensively).

import type { TimeOfDay } from '../world/timeofday';
import type { SiteId } from './species';
import type { Stack } from './inventory';
import type { RawPhoto } from './photos';
import type { QuestStatus } from './quests';

export interface PhotoRecord {
  id: number;
  species: string | null;
  behavior: string | null;
  others: string[];
  stars: number;
  score: number;
  site: string;
  time: TimeOfDay;
  video: boolean;
  thumb: string;
  notes: string[];
}

export interface SaveData {
  version: number;
  chapter: number;
  flags: Record<string, boolean>;
  /** numeric counters (crates secured, snares checked, analyses...) */
  vars: Record<string, number>;
  rp: number;
  totalRp: number;
  skills: Record<string, boolean>;
  /** backpack stacks */
  inv: Stack[];
  /** tool belt (tools never take backpack space) */
  tools: string[];
  seen: Record<string, boolean>;
  /** species pointed at by lab analysis but not yet photographed */
  hints: Record<string, boolean>;
  evPhoto: Record<string, boolean>;
  evVideo: Record<string, boolean>;
  clues: Record<string, boolean>;
  facts: Record<string, boolean>;
  best: Record<string, { thumb: string; stars: number; behavior: string | null }>;
  /** reviewed photos kept in the album */
  album: PhotoRecord[];
  /** unreviewed photos straight off the camera */
  raw: RawPhoto[];
  /** times each sample type has been analysed */
  analyzed: Record<string, number>;
  quests: Record<string, QuestStatus>;
  tracked: string | null;
  /** camp construction progress (stage count) */
  builds: Record<string, number>;
  /** resource node id -> day it regrows */
  nodes: Record<string, number>;
  sites: SiteId[];
  day: number;
  campTime: TimeOfDay;
  /** active food buff for the next expedition ('steady' | 'quiet' | 'energy') */
  buff: string | null;
  settings: { music: number; sfx: number; quality: number };
  photoId: number;
}

const KEY = 'project-zealandia-save-v2';

export function newSave(): SaveData {
  return {
    version: 2, chapter: 0, flags: {}, vars: {}, rp: 0, totalRp: 0, skills: {},
    inv: [{ id: 'ration', n: 3 }], tools: ['camera', 'knife', 'jar', 'translator'],
    seen: {}, hints: {}, evPhoto: {}, evVideo: {}, clues: {}, facts: {}, best: {}, album: [], raw: [], analyzed: {},
    quests: {}, tracked: null, builds: {}, nodes: {},
    sites: [], day: 1, campTime: 'day', buff: null,
    settings: { music: 0.6, sfx: 0.8, quality: 1 }, photoId: 1,
  };
}

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<SaveData>;
    const base = newSave();
    return { ...base, ...d, settings: { ...base.settings, ...d.settings } } as SaveData;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData) {
  try {
    // keep photo storage bounded so we stay well under storage limits
    if (d.album.length > 40) d.album = d.album.slice(-40);
    if (d.raw.length > 30) d.raw = d.raw.slice(-30);
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    try {
      d.album = d.album.slice(-12);
      d.raw = d.raw.slice(-10);
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
