// MoriOS: the Zealandia Encyclopedia app. Since V11 the encyclopedia is a physical book (see
// ../v11/encybook.ts: the same entries, categories and completion as before, from ./encyData.ts):
// launching the app from the laptop lifts the book out over the screen, opened at the entry asked
// for, and every page it files as seen refreshes the laptop's badges.

import type { OSCtx, ResearchApps } from '../v4/moriResearch';

export interface EncApp { open(key?: string): void; refresh(): void }

export function encyclopediaApp(os: OSCtx, ra: ResearchApps): EncApp {
  void ra;
  return {
    open: (key?: string) => {
      void import('../v11/encybook').then(m => m.openEncyclopedia({ key, onChange: () => { if (!os.closed()) os.badges(); } }));
    },
    // the book lays itself out fresh every time it opens: nothing to refresh while it's shut
    refresh: () => {},
  };
}
