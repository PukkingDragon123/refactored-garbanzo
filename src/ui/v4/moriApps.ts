// MoriOS app availability. A fresh laptop has three apps: the morning Report, the survey Spreadsheet
// and Upload Everything. The rest unlock with progress and are then "downloaded" onto the desktop
// (the installer toast in moriOS.ts), arriving with a NEW badge until first opened. State lives in the
// 'apps' bucket of game.save.v10: got = installed, fresh = installed but never opened.

import { game } from '../../game/game';
import { bucket } from '../../game/v10/store';
import { dayNumber } from '../../game/v10/day';
import { r10 } from '../../game/v9/research9';

/** always on the desktop */
export const BASE_APPS = ['report', 'sheet', 'upall'];

interface AppsSave { got: string[]; fresh: string[] }
const st = () => {
  const b = bucket<AppsSave>('apps', () => ({ got: [], fresh: [] }));
  if (!Array.isArray(b.got)) b.got = [];
  if (!Array.isArray(b.fresh)) b.fresh = [];
  return b;
};

export interface AppUnlock { id: string; name: string; why: string; when: () => boolean; hint?: string }

const uploaded = () => (game.save.uploads?.length ?? 0) > 0;
/** anything in the encyclopedia yet: a documented species, a specimen in the crate, a filed field note */
const documented = () => {
  if (Object.keys(game.save.research ?? {}).length > 0) return true;
  const r = r10();
  return r.crate.length > 0 || Object.keys(r.filed).length > 0 || Object.keys(r.lab).length > 0;
};
const laterDays = () => dayNumber() >= 2;

/** the downloadable apps, in desktop order, with what unlocks each */
export const UNLOCKS: AppUnlock[] = [
  { id: 'enc', name: 'Zealandia Encyclopedia', why: 'Your first research is in. The agency sent its encyclopedia.', when: documented, hint: 'It downloads after your first upload with something new in it.' },
  { id: 'photos', name: 'Photos', why: 'Your first photo is uploaded.', when: uploaded, hint: 'It downloads once your first photo is uploaded.' },
  { id: 'cam', name: 'Camera Import', why: 'Pick and choose photos off the ZX-7.', when: uploaded, hint: 'For now, Upload All takes everything off the camera.' },
  { id: 'skills', name: 'Skill Tree', why: 'You have Research Points to spend.', when: () => (game.save.rp ?? 0) > 0 || (game.save.totalRp ?? 0) > 0, hint: 'It downloads when you earn your first Research Points.' },
  { id: 'mail', name: 'ZEA Mail', why: 'The agency is on the line.', when: () => !!game.save.flags['v10:agency'] || (laterDays() && uploaded()), hint: 'It downloads once the agency gets in touch.' },
  { id: 'files', name: 'Files', why: 'Every file survived.', when: () => !!game.save.flags['v9:laptop'] || laterDays() },
  { id: 'plankton', name: 'Plankton Sort', why: 'Something for the long evenings at camp.', when: laterDays },
  { id: 'bubbles', name: 'Bubble Pop', why: 'Something for the long evenings at camp.', when: laterDays },
  { id: 'term', name: 'JennaShell', why: 'Jenna installed it "for emergencies".', when: laterDays },
  { id: 'bin', name: 'Recycle Bin', why: '2,038 photos of Chunk, restored.', when: () => !!game.save.flags['v9:laptop'] || laterDays() },
];
export const UNLOCK_BY_ID: Record<string, AppUnlock> = Object.fromEntries(UNLOCKS.map(u => [u.id, u]));

/** on the desktop now */
export const installed = (id: string) => BASE_APPS.includes(id) || st().got.includes(id);
/** unlocked by progress but not downloaded yet */
export const unlockable = (): AppUnlock[] => UNLOCKS.filter(u => !st().got.includes(u.id) && u.when());
/** installed but never opened (the NEW badge) */
export const isFresh = (id: string) => st().fresh.includes(id);
export function markInstalled(id: string) {
  const s = st();
  if (!s.got.includes(id)) s.got.push(id);
  if (!s.fresh.includes(id)) s.fresh.push(id);
  game.persist();
}
export function markOpened(id: string) {
  const s = st();
  const i = s.fresh.indexOf(id);
  if (i >= 0) { s.fresh.splice(i, 1); game.persist(); }
}
