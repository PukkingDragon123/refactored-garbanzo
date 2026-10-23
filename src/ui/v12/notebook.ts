// V12 contract: Mori's note paper / notebook (quests with pen ticks, the field guide, people, drawing).
// The notebook module owns the real implementation; this stub opens the V11 journal book.
export interface NotebookOpts { page?: 'quests' | 'guide' | 'people' | 'sketch' | string; quest?: string }
export async function openNotebook(o: NotebookOpts = {}): Promise<void> {
  const { openJournal } = await import('../v11/journalbook');
  await openJournal({ quest: o.quest });
}
/** play the pen animation for a finished quest step next time the notebook is shown (or now if open) */
export function markQuestDone(_questId: string, _step?: number): void { /* the notebook module replaces this */ }
