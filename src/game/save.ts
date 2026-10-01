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

/** V9: one animal (species) as the laptop's analysis saw it in an uploaded photo */
export interface UploadSubject {
  species: string;
  /** behaviours shown by the identified individuals */
  beh: string[];
  /** normalised box of the best individual (x0, y0, x1, y1) */
  bbox: [number, number, number, number];
  /** identified (sharp, visible and big enough) */
  ok: boolean;
  /** why not, e.g. 'Too blurry to identify' */
  why?: string;
  stars: number;
  /** individuals of this species in frame */
  n: number;
}

/** V9: a photo uploaded from the camera to MoriOS (a downscaled copy; it leaves the camera) */
export interface UploadRecord {
  /** the camera photo's id */
  id: number;
  /** JPEG data URL, about 320 px wide */
  img: string;
  day: number;
  time: TimeOfDay;
  site: string;
  video: boolean;
  /** upload order */
  n: number;
  subjects: UploadSubject[];
  notes?: string[];
}

/** V9: the research log entry of a species; it exists only once an upload documented it */
export interface ResearchEntry {
  /** upload that first documented it */
  first: number;
  /** cover photo (an upload id, defaults to first) */
  cover: number;
  /** uploads that documented it (oldest first, pruned to a handful) */
  photos: number[];
  /** documented behaviour keys (Species.behaviors) */
  beh: string[];
  /** behaviours documented on video */
  vid: string[];
  /** findings (Fact ids) unlocked by uploads */
  facts: string[];
  /** day it was first documented */
  day: number;
  /** order it was documented in */
  n: number;
  /** best star rating */
  stars: number;
  /** not opened in the research log yet */
  fresh?: boolean;
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
  /** V9: photos uploaded to the laptop */
  uploads: UploadRecord[];
  /** V9: research log keyed by species id */
  research: Record<string, ResearchEntry>;
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
    uploads: [], research: {},
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

/**
 * Keep uploaded photos bounded: every species keeps its first and cover photo plus the newest few
 * others; photos no entry uses (nothing identified) keep only the newest `loose`.
 */
export function pruneUploads(d: SaveData, loose = 16, perSpecies = 5) {
  if (!d.uploads) return;
  const keep = new Set<number>();
  for (const e of Object.values(d.research ?? {})) {
    const others = e.photos.filter(id => id !== e.first && id !== e.cover);
    const room = Math.max(0, perSpecies - (e.first === e.cover ? 1 : 2));
    const tail = new Set(room ? others.slice(-room) : []);
    e.photos = e.photos.filter(id => id === e.first || id === e.cover || tail.has(id));
    for (const id of e.photos) keep.add(id);
    keep.add(e.first);
    keep.add(e.cover);
  }
  const rest = d.uploads.filter(u => !keep.has(u.id));
  if (rest.length <= loose) return;
  const drop = new Set(rest.slice(0, rest.length - loose).map(u => u.id));
  d.uploads = d.uploads.filter(u => !drop.has(u.id));
}

export function writeSave(d: SaveData) {
  try {
    // keep photo storage bounded so we stay well under storage limits
    if (d.album.length > 40) d.album = d.album.slice(-40);
    if (d.raw.length > 30) d.raw = d.raw.slice(-30);
    pruneUploads(d);
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    try {
      d.album = d.album.slice(-12);
      d.raw = d.raw.slice(-10);
      pruneUploads(d, 4, 3);
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch {
      try {
        d.album = [];
        d.raw = d.raw.slice(-4);
        pruneUploads(d, 0, 2);
        localStorage.setItem(KEY, JSON.stringify(d));
      } catch { /* storage unavailable */ }
    }
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
