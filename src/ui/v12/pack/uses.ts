// What an item in the pack can be used for, registered by other modules (the billy can cooks, a
// smoke ball is thrown). The Backpack shows it as a floating action word by the item. Registered by
// item id or by kind ('kind:food'). src/ui/v11/backpack.ts registerItemUse forwards here.
import { ITEMS } from '../../../game/items';

export type UseFn = (id: string) => void | Promise<void>;
export interface ItemUse { label: string; fn: UseFn; icon?: string }
const USES: Record<string, ItemUse> = {};

export function registerUse(idOrKind: string, label: string, fn: UseFn, icon?: string) { USES[idOrKind] = { label, fn, icon }; }
export const useOf = (id: string): ItemUse | null => USES[id] ?? USES['kind:' + (ITEMS[id]?.kind ?? '')] ?? null;
