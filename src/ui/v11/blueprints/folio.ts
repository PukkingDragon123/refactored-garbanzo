// V11 Blueprints: the drafting table (placeholder while the pixel folio is built).
export type FolioAt = 'bench' | 'laptop' | 'field';
export interface FolioOpts { at?: FolioAt; focus?: string }
export interface FolioResult { crafted: string[]; researched: string | null }
export async function openFolio(o: FolioOpts = {}): Promise<FolioResult> { void o; return { crafted: [], researched: null }; }
